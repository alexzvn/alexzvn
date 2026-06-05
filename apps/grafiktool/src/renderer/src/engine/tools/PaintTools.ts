import type { Point, ToolId } from '../types';
import type { Rect } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import type { RasterLayer } from '../doc/Layer';
import { drawStampLine } from '../raster/brush';
import { clipStrokeToSelection } from '../raster/strokeClip';
import { rasterPatchCommand, snapshot } from '../history/commands';
import { docToLocal } from '../doc/transform';

/** Shared brush/eraser behavior; subclasses only differ by erase mode + label. */
abstract class PaintTool implements Tool {
  abstract id: ToolId;
  protected abstract erase: boolean;
  protected abstract label: string;

  private painting = false;
  private layer: RasterLayer | null = null;
  private before: HTMLCanvasElement | null = null;
  private last: Point | null = null;
  private dirty: Rect | null = null;
  private clip: Path2D | null = null;

  cursor(): string {
    return 'crosshair';
  }

  private toLocal(p: Point, layer: RasterLayer): Point {
    return docToLocal(layer, p);
  }

  private expandDirty(p: Point, size: number): void {
    const r = size / 2 + 2;
    const box = { x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 };
    if (!this.dirty) {
      this.dirty = box;
      return;
    }
    const x1 = Math.min(this.dirty.x, box.x);
    const y1 = Math.min(this.dirty.y, box.y);
    const x2 = Math.max(this.dirty.x + this.dirty.width, box.x + box.width);
    const y2 = Math.max(this.dirty.y + this.dirty.height, box.y + box.height);
    this.dirty = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const layer = ctx.ensureRasterLayer();
    if (layer.locked) return;
    this.painting = true;
    this.layer = layer;
    this.before = snapshot(layer.canvas);
    this.dirty = null;
    // Live clip for selections that expose an outline (marquee/lasso).
    const sel = ctx.doc.selection;
    this.clip = null;
    if (sel?.outlines) {
      const path = new Path2D();
      for (const poly of sel.outlines) {
        poly.forEach((pt, i) => {
          const lp = docToLocal(layer, pt);
          if (i === 0) path.moveTo(lp.x, lp.y);
          else path.lineTo(lp.x, lp.y);
        });
        path.closePath();
      }
      this.clip = path;
    }
    const local = this.toLocal(e.doc, layer);
    this.last = local;
    const lctx = layer.canvas.getContext('2d')!;
    drawStampLine(lctx, local, local, ctx.brush, this.erase ? null : ctx.foreground, this.erase, this.clip);
    this.expandDirty(local, ctx.brush.size);
    ctx.requestRender();
  }

  onPointerMove(e: PointerInfo, ctx: ToolContext): void {
    if (!this.painting || !this.layer || !this.last) return;
    const local = this.toLocal(e.doc, this.layer);
    const lctx = this.layer.canvas.getContext('2d')!;
    drawStampLine(lctx, this.last, local, ctx.brush, this.erase ? null : ctx.foreground, this.erase, this.clip);
    this.expandDirty(local, ctx.brush.size);
    this.last = local;
    ctx.requestRender();
  }

  onPointerUp(_e: PointerInfo, ctx: ToolContext): void {
    if (!this.painting || !this.layer || !this.before || !this.dirty) {
      this.reset();
      return;
    }
    const layer = this.layer;
    const sel = ctx.doc.selection;
    // For outline-less selections (wand), the live clip didn't apply — correct now.
    if (sel && !sel.outlines) {
      clipStrokeToSelection(layer.canvas, this.before, sel, this.dirty, layer);
    }
    const cmd = rasterPatchCommand(this.label, layer.canvas, this.before, this.dirty);
    if (cmd) ctx.history.push(cmd);
    this.reset();
    ctx.requestRender();
  }

  onPointerLeave(e: PointerInfo, ctx: ToolContext): void {
    if (this.painting) this.onPointerUp(e, ctx);
  }

  private reset(): void {
    this.painting = false;
    this.layer = null;
    this.before = null;
    this.last = null;
    this.dirty = null;
    this.clip = null;
  }
}

export class BrushTool extends PaintTool {
  id: ToolId = 'brush';
  protected erase = false;
  protected label = 'Pinsel';
}

export class EraserTool extends PaintTool {
  id: ToolId = 'eraser';
  protected erase = true;
  protected label = 'Radierer';
}
