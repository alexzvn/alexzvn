import type { Document } from '../doc/Document';
import type { Layer } from '../doc/Layer';
import type { Viewport } from '../viewport/Viewport';
import type { ShapeStyle, TextStyle } from '../types';
import { blendToGCO } from '../doc/BlendMode';
import { layerMatrix } from '../doc/transform';
import { rgbaToCss } from '../color';
import { createCanvas, type Canvas2D } from '../canvas';

/** Lines of a text layer, split on hard newlines. */
function textLines(style: TextStyle): string[] {
  return style.text.split('\n');
}

/** Draw a text layer's content at the local origin (offset applied by caller). */
export function renderTextContent(ctx: CanvasRenderingContext2D, style: TextStyle): void {
  ctx.save();
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  ctx.textBaseline = 'top';
  const lines = textLines(style);
  const lineH = style.fontSize * style.lineHeight;
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
  const blockH = lines.length * lineH;
  const pad = style.padding;

  if (style.background) {
    ctx.fillStyle = rgbaToCss(style.background);
    ctx.fillRect(0, 0, maxW + pad * 2, blockH + pad * 2);
  }

  ctx.fillStyle = rgbaToCss(style.color);
  ctx.textAlign = style.align;
  const anchorX = style.align === 'left' ? pad : style.align === 'center' ? pad + maxW / 2 : pad + maxW;
  lines.forEach((line, i) => {
    ctx.fillText(line, anchorX, pad + i * lineH);
  });
  ctx.restore();
}

/** Draw a shape layer's content at the local origin. */
export function renderShapeContent(ctx: CanvasRenderingContext2D, style: ShapeStyle): void {
  const { bounds: b } = style;
  ctx.save();
  if (style.fill) ctx.fillStyle = rgbaToCss(style.fill);
  if (style.stroke) {
    ctx.strokeStyle = rgbaToCss(style.stroke);
    ctx.lineWidth = style.strokeWidth;
  }
  ctx.beginPath();
  if (style.shape === 'rectangle') {
    ctx.rect(b.x, b.y, b.width, b.height);
  } else if (style.shape === 'ellipse') {
    ctx.ellipse(
      b.x + b.width / 2,
      b.y + b.height / 2,
      Math.abs(b.width / 2),
      Math.abs(b.height / 2),
      0,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + b.width, b.y + b.height);
  }
  if (style.fill && style.shape !== 'line') ctx.fill();
  if (style.stroke && style.strokeWidth > 0) ctx.stroke();
  ctx.restore();
}

/** Render one layer's raw content (no offset/opacity/blend) into a context. */
export function renderLayerContent(ctx: CanvasRenderingContext2D, layer: Layer): void {
  if (layer.kind === 'raster') {
    ctx.drawImage(layer.canvas, 0, 0);
  } else if (layer.kind === 'text') {
    renderTextContent(ctx, layer.style);
  } else {
    renderShapeContent(ctx, layer.style);
  }
}

/**
 * CPU Canvas2D compositor. Flattens the layer stack into an accumulator at
 * document resolution (honoring offset, mask, opacity, blend mode), then blits
 * the result into the viewport with the current pan/zoom. The accumulator and
 * a scratch buffer are reused across frames.
 */
export class Canvas2DCompositor {
  private acc: Canvas2D | null = null;
  private scratch: Canvas2D | null = null;
  private checker: CanvasPattern | null = null;

  private ensureBuffers(w: number, h: number): { acc: Canvas2D; scratch: Canvas2D } {
    if (!this.acc || this.acc.canvas.width !== w || this.acc.canvas.height !== h) {
      this.acc = createCanvas(w, h);
      this.scratch = createCanvas(w, h);
    }
    return { acc: this.acc, scratch: this.scratch! };
  }

  /** Composite every visible layer into the accumulator buffer. */
  private compositeLayers(doc: Document): Canvas2D {
    const { acc, scratch } = this.ensureBuffers(doc.width, doc.height);
    acc.ctx.clearRect(0, 0, doc.width, doc.height);
    for (const layer of doc.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      scratch.ctx.clearRect(0, 0, doc.width, doc.height);
      const m = layerMatrix(layer);
      scratch.ctx.save();
      scratch.ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      renderLayerContent(scratch.ctx, layer);
      // The mask lives in the same local space as the content, so it scales and
      // rotates together with the layer.
      if (layer.mask) {
        scratch.ctx.globalCompositeOperation = 'destination-in';
        scratch.ctx.drawImage(layer.mask, 0, 0);
      }
      scratch.ctx.restore();
      acc.ctx.save();
      acc.ctx.globalAlpha = layer.opacity;
      acc.ctx.globalCompositeOperation = blendToGCO(layer.blendMode);
      acc.ctx.drawImage(scratch.canvas, 0, 0);
      acc.ctx.restore();
    }
    return acc;
  }

  /** Flatten the document into a fresh document-sized canvas (used for export). */
  flatten(doc: Document): HTMLCanvasElement {
    const acc = this.compositeLayers(doc);
    // Return a stable copy so callers can keep it while buffers are reused.
    const out = createCanvas(doc.width, doc.height);
    out.ctx.drawImage(acc.canvas, 0, 0);
    return out.canvas;
  }

  private checkerPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
    if (this.checker) return this.checker;
    const tile = createCanvas(16, 16);
    tile.ctx.fillStyle = '#3a3a3a';
    tile.ctx.fillRect(0, 0, 16, 16);
    tile.ctx.fillStyle = '#2c2c2c';
    tile.ctx.fillRect(0, 0, 8, 8);
    tile.ctx.fillRect(8, 8, 8, 8);
    this.checker = ctx.createPattern(tile.canvas, 'repeat')!;
    return this.checker;
  }

  /** Composite the document into the viewport target canvas. */
  render(doc: Document, viewport: Viewport, target: CanvasRenderingContext2D, dpr = 1): void {
    const acc = this.compositeLayers(doc);

    const t = target;
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.clearRect(0, 0, t.canvas.width, t.canvas.height);
    t.setTransform(dpr, 0, 0, dpr, 0, 0);
    const origin = viewport.docToScreen({ x: 0, y: 0 });
    const dw = doc.width * viewport.scale;
    const dh = doc.height * viewport.scale;
    // Checkerboard behind the document so transparency reads clearly, then the
    // flattened result on top, scaled to the current zoom.
    t.imageSmoothingEnabled = false;
    t.fillStyle = this.checkerPattern(t);
    t.fillRect(origin.x, origin.y, dw, dh);
    t.imageSmoothingEnabled = viewport.scale < 4; // crisp pixels when zoomed in
    t.drawImage(acc.canvas, origin.x, origin.y, dw, dh);
  }
}
