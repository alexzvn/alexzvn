// Insert-Effekte der JM DAW als kleine Web-Audio-Subgraphen. Jeder Effekt liefert
// ein {input, output}-Paar (für die Kette) und ein update(params) für Live-Tweaks.
// Genutzt in der Spur- und Master-Kette (engine.ts, Realtime + Offline-Export).
import { newId, type EffectInstance } from '@shared/project';

export type EffectKind = 'eq3' | 'compressor' | 'reverb';
export type EffectParams = Record<string, number>;

export interface EffectNode {
  input: AudioNode;
  output: AudioNode;
  /** Parameter live übernehmen (ohne Neuaufbau, soweit möglich). */
  update(params: EffectParams): void;
}

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface EffectDef {
  kind: EffectKind;
  label: string;
  params: ParamDef[];
}

/** Metadaten für UI + Defaults. */
export const EFFECT_DEFS: Record<EffectKind, EffectDef> = {
  eq3: {
    kind: 'eq3',
    label: 'EQ (3-Band)',
    params: [
      { key: 'low', label: 'Bass', min: -18, max: 18, step: 0.5, default: 0, unit: 'dB' },
      { key: 'mid', label: 'Mitten', min: -18, max: 18, step: 0.5, default: 0, unit: 'dB' },
      { key: 'midFreq', label: 'Mitten-Freq.', min: 250, max: 6000, step: 10, default: 1000, unit: 'Hz' },
      { key: 'high', label: 'Höhen', min: -18, max: 18, step: 0.5, default: 0, unit: 'dB' },
    ],
  },
  compressor: {
    kind: 'compressor',
    label: 'Kompressor',
    params: [
      { key: 'threshold', label: 'Threshold', min: -60, max: 0, step: 1, default: -24, unit: 'dB' },
      { key: 'ratio', label: 'Ratio', min: 1, max: 20, step: 0.5, default: 4, unit: ':1' },
      { key: 'attack', label: 'Attack', min: 0, max: 200, step: 1, default: 5, unit: 'ms' },
      { key: 'release', label: 'Release', min: 20, max: 1000, step: 10, default: 150, unit: 'ms' },
      { key: 'knee', label: 'Knee', min: 0, max: 40, step: 1, default: 6, unit: 'dB' },
    ],
  },
  reverb: {
    kind: 'reverb',
    label: 'Reverb',
    params: [
      { key: 'mix', label: 'Anteil', min: 0, max: 1, step: 0.01, default: 0.25, unit: '' },
      { key: 'decay', label: 'Nachhall', min: 0.2, max: 5, step: 0.1, default: 1.8, unit: 's' },
    ],
  },
};

/** Default-Parameter eines Effekt-Typs als Objekt. */
export function defaultParams(kind: EffectKind): EffectParams {
  const out: EffectParams = {};
  for (const p of EFFECT_DEFS[kind].params) out[p.key] = p.default;
  return out;
}

/** Neue Effekt-Instanz mit Default-Parametern. */
export function defaultEffect(kind: EffectKind): EffectInstance {
  return { id: newId('fx'), kind, params: defaultParams(kind) };
}

const num = (p: EffectParams, k: string, fallback: number): number =>
  typeof p[k] === 'number' && Number.isFinite(p[k]) ? p[k] : fallback;

/** Synthetisches Impulse-Response (abklingendes Rauschen) für den Reverb. */
function generateIR(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(decaySec * sr));
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
    }
  }
  return ir;
}

function createEq3(ctx: BaseAudioContext): EffectNode {
  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 150;
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1000;
  mid.Q.value = 0.9;
  const high = ctx.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 6000;
  low.connect(mid);
  mid.connect(high);
  return {
    input: low,
    output: high,
    update(p) {
      low.gain.value = num(p, 'low', 0);
      mid.gain.value = num(p, 'mid', 0);
      mid.frequency.value = num(p, 'midFreq', 1000);
      high.gain.value = num(p, 'high', 0);
    },
  };
}

function createCompressor(ctx: BaseAudioContext): EffectNode {
  const c = ctx.createDynamicsCompressor();
  return {
    input: c,
    output: c,
    update(p) {
      c.threshold.value = num(p, 'threshold', -24);
      c.ratio.value = num(p, 'ratio', 4);
      c.attack.value = num(p, 'attack', 5) / 1000;
      c.release.value = num(p, 'release', 150) / 1000;
      c.knee.value = num(p, 'knee', 6);
    },
  };
}

function createReverb(ctx: BaseAudioContext): EffectNode {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();
  input.connect(dry);
  dry.connect(output);
  input.connect(convolver);
  convolver.connect(wet);
  wet.connect(output);
  let lastDecay = -1;
  return {
    input,
    output,
    update(p) {
      const mix = Math.max(0, Math.min(1, num(p, 'mix', 0.25)));
      dry.gain.value = 1 - mix;
      wet.gain.value = mix;
      const decay = num(p, 'decay', 1.8);
      if (decay !== lastDecay) {
        convolver.buffer = generateIR(ctx, decay);
        lastDecay = decay;
      }
    },
  };
}

/** Effekt-Instanz → Web-Audio-Subgraph. */
export function createEffect(ctx: BaseAudioContext, inst: EffectInstance): EffectNode {
  switch (inst.kind as EffectKind) {
    case 'eq3':
      return createEq3(ctx);
    case 'compressor':
      return createCompressor(ctx);
    case 'reverb':
      return createReverb(ctx);
    default:
      // Unbekannt → neutraler Durchgang.
      const g = ctx.createGain();
      return { input: g, output: g, update() {} };
  }
}
