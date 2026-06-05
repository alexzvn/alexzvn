import type { Point, Rect, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import { rectFromPoints, snapRectToDoc } from '../geometry';
import { makeCommand } from '../history/commands';

/** Drag a rectangle, release to crop the document (and reposition all layers). */
export class CropTool implements Tool {
  id: ToolId = 'crop';
  private start: Point | null = null;

  cursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerInfo): void {
    this.start = e.doc;
  }

  onPointerMove(e: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    const rect = rectFromPoints(this.start, e.doc);
    ctx.setPreview((o) => o.cropPreview(rect, ctx.doc.width, ctx.doc.height));
    ctx.requestRender();
  }

  onPointerUp(e: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    const raw = rectFromPoints(this.start, e.doc);
    this.start = null;
    ctx.setPreview(null);
    const doc = ctx.doc;
    const rect: Rect = snapRectToDoc(raw, doc.width, doc.height);
    if (rect.width < 4 || rect.height < 4) {
      ctx.requestRender();
      return;
    }

    const prevW = doc.width;
    const prevH = doc.height;

    // Crop is non-destructive: offset is a pure translation, so shifting every
    // layer by -rect and resizing the document is correct even for scaled or
    // rotated layers. Layer pixel buffers keep their data (clipped to the new
    // bounds visually), so undo just restores the offsets and size.
    const ops = doc.layers.map((layer) => ({ layer, ox: layer.offsetX, oy: layer.offsetY }));

    const apply = (): void => {
      doc.width = rect.width;
      doc.height = rect.height;
      for (const op of ops) {
        op.layer.offsetX = op.ox - rect.x;
        op.layer.offsetY = op.oy - rect.y;
      }
      doc.selection = null;
    };
    const revert = (): void => {
      doc.width = prevW;
      doc.height = prevH;
      for (const op of ops) {
        op.layer.offsetX = op.ox;
        op.layer.offsetY = op.oy;
      }
    };

    apply();
    ctx.history.push(makeCommand('Freistellen (Crop)', apply, revert));
    ctx.layersChanged();
    ctx.requestRender();
  }
}
