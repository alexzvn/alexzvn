// Adaptive rising-edge detector with sub-sample interpolation. Used for the
// video flash (luminance signal), but fully generic and DOM-free so it can be
// unit-tested against synthetic signals.

export interface EdgeOptions {
  /** Fraction of the lo→hi range used as the trigger threshold (0..1). */
  threshold: number;
  /** Minimum lo→hi contrast required to consider an edge real. */
  minContrast: number;
  /** Ignore further triggers for this long after firing (ms). */
  refractoryMs: number;
  /** How fast the adaptive lo/hi envelope decays back toward the signal (0..1). */
  decay: number;
}

export const DEFAULT_EDGE_OPTIONS: EdgeOptions = {
  threshold: 0.5,
  minContrast: 0.04,
  refractoryMs: 400,
  decay: 0.05,
};

export class RisingEdgeDetector {
  private opts: EdgeOptions;
  private lo = NaN;
  private hi = NaN;
  private prevValue = NaN;
  private prevTime = NaN;
  private armed = true;
  private lastFire = -Infinity;

  constructor(opts: Partial<EdgeOptions> = {}) {
    this.opts = { ...DEFAULT_EDGE_OPTIONS, ...opts };
  }

  /**
   * Feeds one sample. Returns the interpolated crossing time (ms) when a rising
   * edge is detected, otherwise null.
   */
  push(value: number, timeMs: number): number | null {
    // Initialise envelope on the first sample.
    if (Number.isNaN(this.lo)) {
      this.lo = value;
      this.hi = value;
      this.prevValue = value;
      this.prevTime = timeMs;
      return null;
    }

    // Track an adaptive lo/hi envelope: snap to new extremes, decay slowly back.
    this.hi = value > this.hi ? value : this.hi + (value - this.hi) * this.opts.decay;
    this.lo = value < this.lo ? value : this.lo + (value - this.lo) * this.opts.decay;

    const range = this.hi - this.lo;
    const threshold = this.lo + this.opts.threshold * range;

    let crossing: number | null = null;

    if (
      this.armed &&
      range >= this.opts.minContrast &&
      this.prevValue < threshold &&
      value >= threshold &&
      timeMs - this.lastFire >= this.opts.refractoryMs
    ) {
      // Linear interpolation to the exact threshold crossing.
      const span = value - this.prevValue;
      const frac = span > 0 ? (threshold - this.prevValue) / span : 0;
      crossing = this.prevTime + frac * (timeMs - this.prevTime);
      this.armed = false;
      this.lastFire = timeMs;
    }

    // Re-arm once the signal has dropped well below the threshold again.
    if (!this.armed && value <= this.lo + 0.3 * range) {
      this.armed = true;
    }

    this.prevValue = value;
    this.prevTime = timeMs;
    return crossing;
  }

  reset(): void {
    this.lo = NaN;
    this.hi = NaN;
    this.prevValue = NaN;
    this.prevTime = NaN;
    this.armed = true;
    this.lastFire = -Infinity;
  }
}
