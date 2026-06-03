import type { Layer } from '../doc/Layer';
import { createCanvas } from '../canvas';
import { renderLayerContent } from '../compositor/Canvas2DCompositor';

/**
 * Render a single layer's appearance (offset + mask baked in) into a
 * document-sized canvas. Used when exporting to formats that store each layer
 * as a positioned bitmap (PSD).
 */
export function renderLayerToCanvas(layer: Layer, width: number, height: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(width, height);
  ctx.save();
  ctx.translate(layer.offsetX, layer.offsetY);
  renderLayerContent(ctx, layer);
  ctx.restore();
  if (layer.mask) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(layer.mask, 0, 0);
    ctx.restore();
  }
  return canvas;
}
