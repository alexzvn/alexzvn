// Web-Audio-Engine der JM DAW: baut pro Wiedergabe einen Graphen
//   Clip-Source → clipGain(+Fade) → trackGain → trackPan → master → Ausgabe,
// hält den Playhead sample-genau an ctx.currentTime und rendert den Export
// offline (OfflineAudioContext). Bewusst hinter dem schmalen AudioEngine-
// Interface gekapselt, damit später eine native Engine andocken kann (Slice ≥).
import {
  clipDurationUs,
  effectiveTrackGain,
  projectDurationUs,
  usToSec,
  secToUs,
  type Project,
  type Clip,
} from '@shared/project';
import { audioContext, cachedBuffer, decodeAsset } from './decode';
import { createEffect, type EffectNode, type EffectParams } from './effects';

export interface MeterData {
  /** Master-Spitze 0..1. */
  master: number;
  /** Spur-Spitze 0..1 je Track-ID. */
  tracks: Record<string, number>;
}

export interface AudioEngine {
  /** Alle von Clips referenzierten Assets dekodieren (Cache). */
  ensureDecoded(project: Project): Promise<void>;
  play(project: Project, fromUs: number): Promise<void>;
  stop(): void;
  isPlaying(): boolean;
  /** Aktuelle Wiedergabeposition (µs). */
  positionUs(): number;
  /** Live-Mix (Fader/Pan/Mute/Solo/Master) auf laufende Knoten anwenden. */
  updateMix(project: Project): void;
  meters(): MeterData;
  /** Projekt offline zu einem Stereo-AudioBuffer rendern (Export). */
  renderOffline(project: Project): Promise<AudioBuffer>;
}

interface TrackNodes {
  gain: GainNode;
  pan: StereoPannerNode;
  analyser?: AnalyserNode;
}

/** Kleiner Vorlauf, damit alle Quellen sicher gleichzeitig starten. */
const SCHEDULE_LEAD_SEC = 0.06;

class WebAudioEngine implements AudioEngine {
  private playing = false;
  private startCtxTime = 0;
  private startUs = 0;
  private lastPositionUs = 0;
  private sources: AudioBufferSourceNode[] = [];
  private trackNodes = new Map<string, TrackNodes>();
  private masterAnalyser: AnalyserNode | null = null;
  /** Live-Effekt-Knoten je Spur bzw. Master (für Param-Tweaks ohne Neuaufbau). */
  private trackFx = new Map<string, Map<string, EffectNode>>();
  private masterFx = new Map<string, EffectNode>();
  /** Signatur der Effekt-/Spur-Struktur; weicht sie ab → Graph neu aufbauen. */
  private liveFxSignature = '';

  async ensureDecoded(project: Project): Promise<void> {
    const ids = new Set<string>();
    for (const t of project.tracks) for (const c of t.clips) if (c.enabled) ids.add(c.assetId);
    const assets = project.assets.filter((a) => ids.has(a.id) && !cachedBuffer(a.id));
    await Promise.all(assets.map((a) => decodeAsset(a).catch((err) => {
      console.error(`Dekodierung fehlgeschlagen: ${a.fileName}`, err);
    })));
  }

  async play(project: Project, fromUs: number): Promise<void> {
    const ctx = audioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    await this.ensureDecoded(project);
    this.teardown();

    const when = ctx.currentTime + SCHEDULE_LEAD_SEC;
    this.startCtxTime = when;
    this.startUs = fromUs;
    this.lastPositionUs = fromUs;

    // Master: Bus → [Master-FX] → Master-Fader → Analyser → Ausgabe.
    const masterFx = new Map<string, EffectNode>();
    const masterChain = this.buildChain(ctx, project.master.effects, masterFx);
    const masterGain = ctx.createGain();
    masterGain.gain.value = project.master.gain;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    masterChain.output.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    this.masterAnalyser = analyser;
    this.masterGainNode = masterGain;
    this.masterFx = masterFx;

    this.buildTracks(ctx, project, masterChain.input, { when, fromUs, realtime: true });
    this.liveFxSignature = fxSignature(project);
    this.playing = true;
  }

  stop(): void {
    if (this.playing) this.lastPositionUs = this.positionUs();
    this.teardown();
    this.playing = false;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  positionUs(): number {
    if (!this.playing) return this.lastPositionUs;
    const ctx = audioContext();
    const elapsedUs = secToUs(Math.max(0, ctx.currentTime - this.startCtxTime));
    return this.startUs + elapsedUs;
  }

  updateMix(project: Project): void {
    if (!this.playing) return;
    // Strukturänderung (Spur/Effekt hinzugefügt/entfernt) → Graph neu aufbauen.
    const sig = fxSignature(project);
    if (sig !== this.liveFxSignature) {
      this.liveFxSignature = sig;
      void this.play(project, this.positionUs());
      return;
    }
    const ctx = audioContext();
    const t = ctx.currentTime;
    for (const track of project.tracks) {
      const nodes = this.trackNodes.get(track.id);
      if (nodes) {
        nodes.gain.gain.setTargetAtTime(effectiveTrackGain(project, track), t, 0.01);
        nodes.pan.pan.setTargetAtTime(track.pan, t, 0.01);
      }
      const fx = this.trackFx.get(track.id);
      if (fx && track.effects) for (const inst of track.effects) fx.get(inst.id)?.update(inst.params as EffectParams);
    }
    this.masterGainNode?.gain.setTargetAtTime(project.master.gain, t, 0.01);
    if (project.master.effects) {
      for (const inst of project.master.effects) this.masterFx.get(inst.id)?.update(inst.params as EffectParams);
    }
  }

  meters(): MeterData {
    const tracks: Record<string, number> = {};
    if (!this.playing) return { master: 0, tracks };
    for (const [id, nodes] of this.trackNodes) {
      tracks[id] = nodes.analyser ? peakOf(nodes.analyser) : 0;
    }
    const master = this.masterAnalyser ? peakOf(this.masterAnalyser) : 0;
    return { master, tracks };
  }

  async renderOffline(project: Project): Promise<AudioBuffer> {
    await this.ensureDecoded(project);
    const durUs = projectDurationUs(project);
    const sampleRate = project.sampleRate;
    const lengthSamples = Math.ceil(usToSec(durUs) * sampleRate);
    if (lengthSamples <= 0) throw new Error('Timeline ist leer.');

    const offline = new OfflineAudioContext(2, lengthSamples, sampleRate);
    const masterChain = this.buildChain(offline, project.master.effects);
    const masterGain = offline.createGain();
    masterGain.gain.value = project.master.gain;
    masterChain.output.connect(masterGain);
    masterGain.connect(offline.destination);
    this.buildTracks(offline, project, masterChain.input, { when: 0, fromUs: 0, realtime: false });
    return offline.startRendering();
  }

  // ── intern ─────────────────────────────────────────────────────────────────

  private masterGainNode: GainNode | null = null;

  /** Effekt-Kette: input → fx1 → fx2 → … → output (leer = neutraler Durchgang). */
  private buildChain(
    ctx: BaseAudioContext,
    effects: { id: string; kind: string; params: Record<string, number | string> }[] | undefined,
    refMap?: Map<string, EffectNode>,
  ): { input: GainNode; output: AudioNode } {
    const input = ctx.createGain();
    let prev: AudioNode = input;
    for (const inst of effects ?? []) {
      const node = createEffect(ctx, inst);
      node.update(inst.params as EffectParams);
      prev.connect(node.input);
      prev = node.output;
      refMap?.set(inst.id, node);
    }
    return { input, output: prev };
  }

  private buildTracks(
    ctx: BaseAudioContext,
    project: Project,
    busInput: AudioNode,
    opts: { when: number; fromUs: number; realtime: boolean },
  ): void {
    for (const track of project.tracks) {
      if (track.kind !== 'audio') continue;
      // Clips → [Spur-FX] → Fader → Pan → (Analyser) → Bus.
      const fxMap = opts.realtime ? new Map<string, EffectNode>() : undefined;
      const chain = this.buildChain(ctx, track.effects, fxMap);
      const tg = ctx.createGain();
      tg.gain.value = effectiveTrackGain(project, track);
      const tp = ctx.createStereoPanner();
      tp.pan.value = track.pan;
      chain.output.connect(tg);
      tg.connect(tp);

      if (opts.realtime) {
        const analyser = (ctx as AudioContext).createAnalyser();
        analyser.fftSize = 512;
        tp.connect(analyser);
        analyser.connect(busInput);
        this.trackNodes.set(track.id, { gain: tg, pan: tp, analyser });
        this.trackFx.set(track.id, fxMap!);
      } else {
        tp.connect(busInput);
      }

      for (const clip of track.clips) {
        if (!clip.enabled) continue;
        this.scheduleClip(ctx, clip, chain.input, opts);
      }
    }
  }

  private scheduleClip(
    ctx: BaseAudioContext,
    clip: Clip,
    trackGain: GainNode,
    opts: { when: number; fromUs: number },
  ): void {
    const buffer = cachedBuffer(clip.assetId);
    if (!buffer) return;

    const startSec = usToSec(clip.startUs);
    const inSec = usToSec(clip.inUs);
    const durSec = usToSec(clipDurationUs(clip));
    const fromSec = usToSec(opts.fromUs);
    if (durSec <= 0) return;
    if (startSec + durSec <= fromSec) return; // schon vorbei

    // Wie weit in den Clip wir beim Start bereits hineinspringen.
    const skip = Math.max(0, fromSec - startSec);
    const playOffset = inSec + skip;
    const playDur = durSec - skip;
    if (playDur <= 0) return;
    const when = opts.when + Math.max(0, startSec - fromSec);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const cg = ctx.createGain();
    this.applyFades(cg, clip, when, skip, durSec);
    src.connect(cg);
    cg.connect(trackGain);
    src.start(when, playOffset, playDur);
    this.sources.push(src);
  }

  /** Clip-Gain + lineare Ein-/Ausblende ab dem (evtl. mittendrin gestarteten) Punkt. */
  private applyFades(cg: GainNode, clip: Clip, when: number, skip: number, durSec: number): void {
    const base = clip.gain ?? 1;
    const fadeIn = usToSec(clip.fade?.inUs ?? 0);
    const fadeOut = usToSec(clip.fade?.outUs ?? 0);
    const g = cg.gain;

    const gainAt = (u: number): number => {
      if (fadeIn > 0 && u < fadeIn) return base * (u / fadeIn);
      const foStart = durSec - fadeOut;
      if (fadeOut > 0 && u > foStart) return base * Math.max(0, (durSec - u) / fadeOut);
      return base;
    };

    g.cancelScheduledValues(when);
    g.setValueAtTime(gainAt(skip), when);
    // Ende der Einblende (falls noch nicht erreicht).
    if (fadeIn > skip) g.linearRampToValueAtTime(base, when + (fadeIn - skip));
    // Ausblende.
    const foStart = durSec - fadeOut;
    if (fadeOut > 0) {
      if (foStart > skip) g.setValueAtTime(base, when + (foStart - skip));
      g.linearRampToValueAtTime(0, when + (durSec - skip));
    }
  }

  private teardown(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // schon gestoppt
      }
      s.disconnect();
    }
    this.sources = [];
    this.trackNodes.clear();
    this.trackFx.clear();
    this.masterFx.clear();
    this.masterAnalyser = null;
    this.masterGainNode = null;
  }
}

/**
 * Signatur der Graphen-Struktur: Spuren + ihre Effekte (id:kind) + Master-Effekte.
 * Ändert sie sich gegenüber dem laufenden Graphen, wird neu aufgebaut (Param-
 * Tweaks ändern sie nicht → laufen live).
 */
function fxSignature(project: Project): string {
  const sig = (effs?: { id: string; kind: string }[]): string =>
    (effs ?? []).map((e) => `${e.id}:${e.kind}`).join(',');
  const tracks = project.tracks.map((t) => `${t.id}[${sig(t.effects)}]`).join('|');
  return `${tracks}#M[${sig(project.master.effects)}]`;
}

/** Abs-Spitze aus dem Zeitbereich eines Analysers (0..1). */
function peakOf(analyser: AnalyserNode): number {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = Math.abs(buf[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

/** Modul-Singleton — von Store/Transport/Export genutzt. */
export const engine: AudioEngine = new WebAudioEngine();

// ── WAV-Encode (Render-Buffer → 32-bit-Float-WAV-Bytes für den Export) ───────

export function encodeWavFloat32(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const sampleRate = buffer.sampleRate;
  const blockAlign = channels * 4;
  const dataBytes = frames * blockAlign;
  const out = new Uint8Array(44 + dataBytes);
  const dv = new DataView(out.buffer);

  const writeStr = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 3, true); // IEEE float
  dv.setUint16(22, channels, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * blockAlign, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, 32, true);
  writeStr(36, 'data');
  dv.setUint32(40, dataBytes, true);

  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) chans.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      dv.setFloat32(off, chans[c][i], true);
      off += 4;
    }
  }
  return out;
}
