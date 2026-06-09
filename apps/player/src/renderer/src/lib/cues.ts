import type { Cue } from '@shared/types';

/**
 * WebAudio-Engine fürs Soundboard: dekodiert Cue-Medien einmal in AudioBuffer
 * vor und triggert sie danach latenzarm (getrennt vom Hintergrund-Player).
 * „Theatergong" ohne Decode-Verzögerung beim Tastendruck.
 */
class CueEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<number, AudioBuffer>(); // key = mediaId
  private active = new Map<number, AudioBufferSourceNode>(); // key = cueId

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Medium vordekodieren (idempotent). url = jmplay.mediaUrl(path). */
  async preload(mediaId: number, url: string): Promise<void> {
    if (this.buffers.has(mediaId)) return;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.context().decodeAudioData(arr);
    this.buffers.set(mediaId, buf);
  }

  /** Pad triggern. Lädt bei Bedarf nach und spielt dann (leicht verzögert). */
  play(cue: Cue, url: string): void {
    if (cue.mediaId == null) return;
    const buf = this.buffers.get(cue.mediaId);
    if (!buf) {
      void this.preload(cue.mediaId, url).then(() => this.play(cue, url));
      return;
    }
    this.stop(cue.id); // Re-Trigger: laufende Instanz desselben Pads ablösen
    const ctx = this.context();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = cue.loop;
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, (cue.gainDb || 0) / 20);
    src.connect(gain).connect(ctx.destination);
    src.onended = () => {
      if (this.active.get(cue.id) === src) this.active.delete(cue.id);
    };
    src.start();
    this.active.set(cue.id, src);
  }

  stop(cueId: number): void {
    const src = this.active.get(cueId);
    if (src) {
      try {
        src.stop();
      } catch {
        // bereits beendet
      }
      this.active.delete(cueId);
    }
  }

  stopAll(): void {
    for (const id of [...this.active.keys()]) this.stop(id);
  }

  isPlaying(cueId: number): boolean {
    return this.active.has(cueId);
  }

  /** Buffer für entfernte/ersetzte Cues vergessen. */
  forget(mediaId: number): void {
    this.buffers.delete(mediaId);
  }
}

export const cueEngine = new CueEngine();
