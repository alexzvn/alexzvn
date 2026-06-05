// Pure DSP core for beep-onset detection. No AudioWorklet / DOM dependencies, so
// it can be unit-tested against synthetic tone bursts (tools/engine-selftest.ts)
// AND imported by the AudioWorklet processor that runs on the audio thread.

export interface OnsetCoreOptions {
  sampleRate: number;
  /** Frequency of the reference beep to lock onto (Hz). */
  targetFreq: number;
  /** Analysis window length in samples. */
  windowSize: number;
  /** Hop between successive analysis windows in samples. */
  hopSize: number;
  /** Trigger when tone magnitude exceeds baseline × this factor. */
  riseFactor: number;
  /** Absolute magnitude floor to suppress triggering on silence/noise. */
  floor: number;
  /** Ignore further onsets for this many samples after firing. */
  refractorySamples: number;
  /** Adaptive-baseline smoothing factor (0..1). */
  baselineDecay: number;
}

export function defaultOnsetOptions(sampleRate: number, targetFreq = 1000): OnsetCoreOptions {
  const windowSize = Math.max(64, Math.round(sampleRate * 0.01)); // ~10 ms
  return {
    sampleRate,
    targetFreq,
    windowSize,
    hopSize: windowSize >> 1,
    riseFactor: 4,
    floor: 0.02,
    refractorySamples: Math.round(sampleRate * 0.3),
    baselineDecay: 0.1,
  };
}

/** Goertzel coefficient for a given frequency / sample rate. */
export function goertzelCoeff(targetFreq: number, sampleRate: number, windowSize: number): number {
  const k = Math.round((windowSize * targetFreq) / sampleRate);
  const omega = (2 * Math.PI * k) / windowSize;
  return 2 * Math.cos(omega);
}

/** Normalised Goertzel magnitude (0..~1) of `targetFreq` over buf[start..start+N). */
export function goertzelMagnitude(
  buf: Float32Array | number[],
  start: number,
  N: number,
  coeff: number,
): number {
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    const s0 = buf[start + i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(0, power)) / N;
}

/**
 * Streaming onset detector. Push samples; it buffers, runs Goertzel over sliding
 * windows, and reports onsets as an absolute sample index on the caller's clock.
 */
export class OnsetCore {
  readonly opts: OnsetCoreOptions;
  private readonly coeff: number;
  private buffer: number[] = [];
  private bufferStart = 0; // absolute sample index of buffer[0]
  private nextWindow = 0; // absolute sample index of the next window to analyse
  private baseline = 0;
  private lastFire = -Infinity;
  private armed = true;

  constructor(opts: OnsetCoreOptions) {
    this.opts = opts;
    this.coeff = goertzelCoeff(opts.targetFreq, opts.sampleRate, opts.windowSize);
  }

  /** Returns absolute sample indices of detected onsets in this chunk. */
  push(samples: Float32Array | number[], firstSampleIndex: number): number[] {
    if (this.buffer.length === 0) {
      this.bufferStart = firstSampleIndex;
      this.nextWindow = firstSampleIndex;
    }
    for (let i = 0; i < samples.length; i++) this.buffer.push(samples[i]);

    const onsets: number[] = [];
    const { windowSize, hopSize, riseFactor, floor, baselineDecay, refractorySamples } = this.opts;

    while (this.nextWindow + windowSize <= this.bufferStart + this.buffer.length) {
      const local = this.nextWindow - this.bufferStart;
      const mag = goertzelMagnitude(this.buffer, local, windowSize, this.coeff);
      const onsetIdx = this.nextWindow; // window start = onset reference

      const threshold = Math.max(floor, this.baseline * riseFactor);
      if (
        this.armed &&
        mag >= threshold &&
        onsetIdx - this.lastFire >= refractorySamples
      ) {
        onsets.push(onsetIdx);
        this.lastFire = onsetIdx;
        this.armed = false;
      }
      // Re-arm once the tone has clearly subsided.
      if (!this.armed && mag < Math.max(floor, this.baseline * 1.5)) this.armed = true;

      // Update baseline only while not inside a burst, so it tracks the noise floor.
      if (this.armed) this.baseline += (mag - this.baseline) * baselineDecay;

      this.nextWindow += hopSize;
    }

    // Drop consumed samples we no longer need (keep one window of headroom).
    const keepFrom = this.nextWindow - this.bufferStart - windowSize;
    if (keepFrom > 0) {
      this.buffer.splice(0, keepFrom);
      this.bufferStart += keepFrom;
    }
    return onsets;
  }

  reset(): void {
    this.buffer = [];
    this.bufferStart = 0;
    this.nextWindow = 0;
    this.baseline = 0;
    this.lastFire = -Infinity;
    this.armed = true;
  }
}
