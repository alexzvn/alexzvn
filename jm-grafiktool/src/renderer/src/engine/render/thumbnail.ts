import type { Layer } from '../doc/Layer';
import { createCanvas } from '../canvas';
import { renderLayerContent } from '../compositor/Canvas2DCompositor';

/** Render a small thumbnail (data URL) of a single layer placed in the document. */
export function layerThumbnail(layer: Layer, docW: number, docH: number, max = 40): string {
  const scale = Math.min(max / docW, max / docH);
  const w = Math.max(1, Math.round(docW * scale));
  const h = Math.max(1, Math.round(docH * scale));
  const { canvas, ctx } = createCanvas(w, h);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(layer.offsetX, layer.offsetY);
  try {
    renderLayerContent(ctx, layer);
  } catch {
    /* ignore thumbnail render errors */
  }
  ctx.restore();
  if (layer.mask) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.scale(scale, scale);
    ctx.drawImage(layer.mask, 0, 0);
    ctx.restore();
  }
  return canvas.toDataURL();
}
