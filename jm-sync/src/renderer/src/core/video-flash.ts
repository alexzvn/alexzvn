// Video flash detector. Samples each frame's luminance via requestVideoFrameCallback
// and reports a flash as a sub-frame-interpolated time on the performance clock.

import { RisingEdgeDetector, type EdgeOptions } from './edge';

export interface FlashOptions {
  /** Downscaled sampling resolution for the luminance average. */
  sampleWidth: number;
  sampleHeight: number;
  edge: Partial<EdgeOptions>;
}

export const DEFAULT_FLASH_OPTIONS: FlashOptions = {
  sampleWidth: 32,
  sampleHeight: 18,
  edge: {},
};

/** Average relative luminance (0..1) of an RGBA buffer (Rec. 601 weights). */
export function averageLuminance(data: Uint8ClampedArray): number {
  let sum = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return px > 0 ? sum / px / 255 : 0;
}

export class FlashDetector {
  private opts: FlashOptions;
  private detector: RisingEdgeDetector;
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private gctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private handle = 0;
  private running = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onFlash: (timeMs: number) => void,
    opts: Partial<FlashOptions> = {},
  ) {
    this.opts = { ...DEFAULT_FLASH_OPTIONS, ...opts };
    this.detector = new RisingEdgeDetector(this.opts.edge);

    const { sampleWidth: w, sampleHeight: h } = this.opts;
    this.canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = (this.canvas as HTMLCanvasElement).getContext('2d', {
      willReadFrequently: true,
    });
    if (!ctx) throw new Error('2D-Canvas-Kontext nicht verfügbar.');
    this.gctx = ctx as CanvasRenderingContext2D;
  }

  start(): void {
    if (this.running) return;
    if (typeof this.video.requestVideoFrameCallback !== 'function') {
      throw new Error('requestVideoFrameCallback wird hier nicht unterstützt.');
    }
    this.running = true;
    this.detector.reset();
    this.schedule();
  }

  private schedule(): void {
    this.handle = this.video.requestVideoFrameCallback((now) => this.onFrame(now));
  }

  private onFrame(now: number): void {
    if (!this.running) return;
    const { sampleWidth: w, sampleHeight: h } = this.opts;
    try {
      this.gctx.drawImage(this.video, 0, 0, w, h);
      const lum = averageLuminance(this.gctx.getImageData(0, 0, w, h).data);
      const crossing = this.detector.push(lum, now);
      if (crossing != null) this.onFlash(crossing);
    } catch {
      // Frame not yet decodable (cross-origin / not ready) — skip this frame.
    }
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.handle && typeof this.video.cancelVideoFrameCallback === 'function') {
      this.video.cancelVideoFrameCallback(this.handle);
    }
    this.handle = 0;
  }
}
