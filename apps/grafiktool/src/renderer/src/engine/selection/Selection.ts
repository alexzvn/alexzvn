import type { Point, Rect } from '../types';
import { createCanvas } from '../canvas';

/**
 * A pixel selection: a document-sized 8-bit coverage mask (255 = fully
 * selected). All selection sources — marquee, lasso, magic wand, and later
 * Magic Mask — produce this same representation, so paint/fill/delete clip the
 * same way regardless of how the selection was made.
 *
 * `outlines` (optional) are polygons in document space used to draw crisp
 * marching ants; when absent (e.g. magic wand) the overlay falls back to the
 * bounding box.
 */
export class Selection {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  outlines: Point[][] | null;
  private _bounds: Rect | null | undefined;
  private _maskCanvas: HTMLCanvasElement | null = null;

  constructor(width: number, height: number, data?: Uint8Array, outlines?: Point[][] | null) {
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8Array(width * height);
    this.outlines = outlines ?? null;
  }

  contains(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.data[(y | 0) * this.width + (x | 0)] > 127;
  }

  isEmpty(): boolean {
    return this.bounds() === null;
  }

  bounds(): Rect | null {
    if (this._bounds !== undefined) return this._bounds;
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;
    const { width, height, data } = this;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x] > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    this._bounds = maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    return this._bounds;
  }

  invert(): void {
    const { data } = this;
    for (let i = 0; i < data.length; i++) data[i] = 255 - data[i];
    this._bounds = undefined;
    this._maskCanvas = null;
    this.outlines = null;
  }

  /**
   * A canvas whose alpha channel equals the coverage mask, for clipping paint
   * via `destination-in`. Cached until the mask changes.
   */
  toMaskCanvas(): HTMLCanvasElement {
    if (this._maskCanvas) return this._maskCanvas;
    const { canvas, ctx } = createCanvas(this.width, this.height);
    const img = ctx.createImageData(this.width, this.height);
    const out = img.data;
    for (let i = 0; i < this.data.length; i++) {
      out[i * 4 + 3] = this.data[i];
    }
    ctx.putImageData(img, 0, 0);
    this._maskCanvas = canvas;
    return canvas;
  }
}
