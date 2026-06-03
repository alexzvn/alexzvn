// Pairs video-flash events with audio-beep events (both on the same performance
// clock, in ms) and derives the A/V offset. Sign convention matches SyncSample:
// offsetMs = videoMs − audioMs  →  positive means audio leads video.

import type { MeasurementStats, SyncSample } from '@shared/types';
import { computeStats } from './stats';

export interface CorrelatorOptions {
  /** Max time between a flash and its matching beep to count as a pair (ms). */
  pairWindowMs: number;
  /** Keep at most this many recent events per channel (bounds re-pairing cost). */
  maxEvents: number;
}

export const DEFAULT_CORRELATOR_OPTIONS: CorrelatorOptions = {
  pairWindowMs: 350,
  maxEvents: 64,
};

export class Correlator {
  private opts: CorrelatorOptions;
  private flashes: number[] = [];
  private beeps: number[] = [];
  private cycle = 0;

  constructor(opts: Partial<CorrelatorOptions> = {}) {
    this.opts = { ...DEFAULT_CORRELATOR_OPTIONS, ...opts };
  }

  addFlash(timeMs: number): void {
    this.flashes.push(timeMs);
    if (this.flashes.length > this.opts.maxEvents) this.flashes.shift();
  }

  addBeep(timeMs: number): void {
    this.beeps.push(timeMs);
    if (this.beeps.length > this.opts.maxEvents) this.beeps.shift();
  }

  /** Greedy nearest-neighbour pairing over the buffered events. */
  samples(): SyncSample[] {
    const out: SyncSample[] = [];
    const usedBeep = new Set<number>();
    let cycle = this.cycle;

    for (const videoMs of this.flashes) {
      let bestIdx = -1;
      let bestDist = this.opts.pairWindowMs;
      for (let i = 0; i < this.beeps.length; i++) {
        if (usedBeep.has(i)) continue;
        const dist = Math.abs(this.beeps[i] - videoMs);
        if (dist <= bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        usedBeep.add(bestIdx);
        const audioMs = this.beeps[bestIdx];
        out.push({ cycle: cycle++, videoMs, audioMs, offsetMs: videoMs - audioMs });
      }
    }
    return out;
  }

  stats(): MeasurementStats | null {
    return computeStats(this.samples().map((s) => s.offsetMs));
  }

  reset(): void {
    this.flashes = [];
    this.beeps = [];
    this.cycle = 0;
  }
}
