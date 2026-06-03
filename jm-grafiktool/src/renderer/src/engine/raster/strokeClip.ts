import type { Rect } from '../types';
import type { Selection } from '../selection/Selection';
import { localToDoc, type Transformable } from '../doc/transform';

/**
 * Restrict an already-painted stroke to the active selection. For every pixel
 * in the dirty rect that lies OUTSIDE the selection, restore the pre-stroke
 * pixel from `beforeCanvas`. Handles both painting and erasing correctly, and
 * works with arbitrary (e.g. magic-wand) selections that have no outline path.
 *
 * Coordinates: layer canvas pixel (lx, ly) maps to a document point via the
 * layer transform, where the selection is defined.
 */
export function clipStrokeToSelection(
  layerCanvas: HTMLCanvasElement,
  beforeCanvas: HTMLCanvasElement,
  selection: Selection,
  dirty: Rect,
  layer: Transformable,
): void {
  const x = Math.max(0, Math.floor(dirty.x));
  const y = Math.max(0, Math.floor(dirty.y));
  const w = Math.min(layerCanvas.width - x, Math.ceil(dirty.width));
  const h = Math.min(layerCanvas.height - y, Math.ceil(dirty.height));
  if (w <= 0 || h <= 0) return;

  const ctx = layerCanvas.getContext('2d')!;
  const beforeCtx = beforeCanvas.getContext('2d')!;
  const cur = ctx.getImageData(x, y, w, h);
  const before = beforeCtx.getImageData(x, y, w, h);
  const c = cur.data;
  const b = before.data;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const d = localToDoc(layer, { x: x + px, y: y + py });
      const inside = selection.contains(d.x, d.y);
      if (!inside) {
        const i = (py * w + px) * 4;
        c[i] = b[i];
        c[i + 1] = b[i + 1];
        c[i + 2] = b[i + 2];
        c[i + 3] = b[i + 3];
      }
    }
  }
  ctx.putImageData(cur, x, y);
}
