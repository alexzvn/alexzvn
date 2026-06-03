import type { Rect, RGBA, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import type { RasterLayer } from '../doc/Layer';
import { createCanvas } from '../canvas';
import { rgbaToCss } from '../color';
import { floodFill, maskBounds } from '../raster/PixelOps';
import { rasterPatchCommand, snapshot } from '../history/commands';
import { docToLocal, layerMatrix } from '../doc/transform';

/**
 * Fill bucket — the primary way to make color areas ("Farbflächen"). With an
 * active selection it fills the selection; otherwise it flood-fills the
 * connected region under the cursor by color similarity.
 */
export class FillTool implements Tool {
  id: ToolId = 'fill';

  cursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const layer = ctx.ensureRasterLayer();
    if (layer.locked) return;
    const before = snapshot(layer.canvas);
    const sel = ctx.doc.selection;
    const dirty = sel ? this.fillSelection(layer, sel.toMaskCanvas(), ctx.foreground) : this.floodAt(layer, e, ctx);
    if (dirty) {
      const cmd = rasterPatchCommand('Füllen', layer.canvas, before, dirty);
      if (cmd) ctx.history.push(cmd);
      ctx.requestRender();
    }
  }

  /** Fill the selection (a doc-space alpha mask) with the color. */
  private fillSelection(layer: RasterLayer, maskCanvas: HTMLCanvasElement, color: RGBA): Rect {
    const w = layer.canvas.width;
    const h = layer.canvas.height;
    const tmp = createCanvas(w, h);
    tmp.ctx.fillStyle = rgbaToCss(color);
    tmp.ctx.fillRect(0, 0, w, h);
    tmp.ctx.globalCompositeOperation = 'destination-in';
    tmp.ctx.drawImage(maskCanvas, 0, 0);
    // The selection is in document space; map it into the layer's local space.
    const inv = layerMatrix(layer).inverse();
    const lctx = layer.canvas.getContext('2d')!;
    lctx.save();
    lctx.setTransform(inv.a, inv.b, inv.c, inv.d, inv.e, inv.f);
    lctx.drawImage(tmp.canvas, 0, 0);
    lctx.restore();
    return { x: 0, y: 0, width: w, height: h };
  }

  /** Flood-fill the connected region under the cursor. */
  private floodAt(layer: RasterLayer, e: PointerInfo, ctx: ToolContext): Rect | null {
    const lctx = layer.canvas.getContext('2d')!;
    const img = lctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const local = docToLocal(layer, e.doc);
    const sx = Math.floor(local.x);
    const sy = Math.floor(local.y);
    if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) return null;
    const mask = floodFill(img, sx, sy, ctx.options.tolerance, ctx.options.contiguous);
    const bounds = maskBounds(mask, img.width, img.height);
    if (!bounds) return null;
    const fg = ctx.foreground;
    const out = img.data;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        const j = i * 4;
        out[j] = fg.r;
        out[j + 1] = fg.g;
        out[j + 2] = fg.b;
        out[j + 3] = fg.a;
      }
    }
    lctx.putImageData(img, 0, 0);
    return bounds;
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}
