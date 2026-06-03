import type { Point, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import { rectFromPoints } from '../geometry';
import { selectionFromPolygon, selectionFromRect, selectionFromWand } from '../selection/SelectionOps';

/** Rectangular marquee selection. */
export class MarqueeTool implements Tool {
  id: ToolId = 'marquee';
  private start: Point | null = null;
  private current: Point | null = null;

  cursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerInfo): void {
    this.start = e.doc;
    this.current = e.doc;
  }

  onPointerMove(e: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    this.current = e.doc;
    const rect = rectFromPoints(this.start, this.current);
    ctx.setPreview((o) => o.dashedRect(rect));
    ctx.requestRender();
  }

  onPointerUp(e: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    const rect = rectFromPoints(this.start, e.doc);
    this.start = null;
    this.current = null;
    ctx.setPreview(null);
    if (rect.width < 2 || rect.height < 2) {
      ctx.setSelection(null);
    } else {
      ctx.setSelection(selectionFromRect(ctx.doc.width, ctx.doc.height, rect));
    }
    ctx.requestRender();
  }
}

/** Freehand lasso selection. */
export class LassoTool implements Tool {
  id: ToolId = 'lasso';
  private points: Point[] = [];
  private active = false;

  cursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerInfo): void {
    this.active = true;
    this.points = [e.doc];
  }

  onPointerMove(e: PointerInfo, ctx: ToolContext): void {
    if (!this.active) return;
    this.points.push(e.doc);
    const pts = this.points;
    ctx.setPreview((o) => o.polyline(pts, true));
    ctx.requestRender();
  }

  onPointerUp(_e: PointerInfo, ctx: ToolContext): void {
    if (!this.active) return;
    this.active = false;
    ctx.setPreview(null);
    if (this.points.length >= 3) {
      ctx.setSelection(selectionFromPolygon(ctx.doc.width, ctx.doc.height, this.points));
    } else {
      ctx.setSelection(null);
    }
    this.points = [];
    ctx.requestRender();
  }

  onPointerLeave(e: PointerInfo, ctx: ToolContext): void {
    if (this.active) this.onPointerUp(e, ctx);
  }
}

/** Magic-wand selection on the flattened image by color similarity. */
export class MagicWandTool implements Tool {
  id: ToolId = 'wand';

  cursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const img = ctx.compositeImageData();
    const x = Math.floor(e.doc.x);
    const y = Math.floor(e.doc.y);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const sel = selectionFromWand(img, x, y, ctx.options.tolerance, ctx.options.contiguous);
    ctx.setSelection(sel.isEmpty() ? null : sel);
    ctx.requestRender();
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}
