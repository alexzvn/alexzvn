// Shared types between Electron main/preload and the renderer (and the web/PWA build).

/** Minimal bridge API exposed by the Electron preload as `window.jms`. */
export interface JmsApi {
  platform: NodeJS.Platform;
  app: {
    version(): Promise<string>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Measurement domain (framework-neutral). Consumed by src/renderer/src/core.
// ---------------------------------------------------------------------------

/** Which sensor/source feeds the measurement. */
export type SourceKind = 'camera' | 'capture' | 'display';

/** A single detected flash↔beep pair, in milliseconds on the capture clock. */
export interface SyncSample {
  /** Sequence counter encoded in the generator pattern (for pairing). */
  cycle: number;
  /** Timestamp of the video flash rising edge (ms, capture clock). */
  videoMs: number;
  /** Timestamp of the audio beep onset (ms, capture clock). */
  audioMs: number;
  /**
   * Offset in ms. Positive = audio leads video (audio arrives early);
   * negative = video leads audio. Pipeline A/V offset.
   */
  offsetMs: number;
}

/** Robust aggregate over many {@link SyncSample}s. */
export interface MeasurementStats {
  /** Number of accepted samples after outlier rejection. */
  count: number;
  /** Median offset in ms (the headline number). */
  medianMs: number;
  /** Median absolute deviation — jitter / spread indicator. */
  madMs: number;
  /** Min/max accepted offset, for the range readout. */
  minMs: number;
  maxMs: number;
}

/** Result of the zero/loopback calibration step, subtracted from measurements. */
export interface Calibration {
  /** Systematic generator+capture self-latency in ms. */
  baselineMs: number;
  /** When it was captured, ISO string (stamped by the caller). */
  capturedAt: string;
}
