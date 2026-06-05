import type { Layer } from '../doc/Layer';
import { createCanvas } from '../canvas';
import { renderLayerContent } from '../compositor/Canvas2DCompositor';
import { layerMatrix } from '../doc/transform';

/**
 * Render a single layer's full appearance (transform + mask baked in) into a
 * document-sized canvas. Used when exporting to formats that store each layer
 * as a positioned bitmap (PSD), and as the basis for thumbnails.
 */
export function renderLayerToCanvas(layer: Layer, width: number, height: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(width, height);
  const m = layerMatrix(layer);
  ctx.save();
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  renderLayerContent(ctx, layer);
  if (layer.mask) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(layer.mask, 0, 0);
  }
  ctx.restore();
  return canvas;
}

/**
 * Render a layer's content WITHOUT its transform (identity placement), into a
 * document-sized canvas. Magic Mask segments this so the resulting mask lives
 * in the layer's local space and transforms together with the content.
 */
export function renderLayerLocal(layer: Layer, width: number, height: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(width, height);
  renderLayerContent(ctx, layer);
  return canvas;
}
