import type { Layer } from '../doc/Layer';
import { createCanvas } from '../canvas';
import { renderLayerContent } from '../compositor/Canvas2DCompositor';
import { layerMatrix } from '../doc/transform';

/** Render a small thumbnail (data URL) of a single layer placed in the document. */
export function layerThumbnail(layer: Layer, docW: number, docH: number, max = 40): string {
  const scale = Math.min(max / docW, max / docH);
  const w = Math.max(1, Math.round(docW * scale));
  const h = Math.max(1, Math.round(docH * scale));
  const { canvas, ctx } = createCanvas(w, h);
  // thumb = scale(thumbScale) · layerMatrix
  const m = new DOMMatrix().scaleSelf(scale).multiplySelf(layerMatrix(layer));
  ctx.save();
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  try {
    renderLayerContent(ctx, layer);
    if (layer.mask) {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(layer.mask, 0, 0);
    }
  } catch {
    /* ignore thumbnail render errors */
  }
  ctx.restore();
  return canvas.toDataURL();
}
