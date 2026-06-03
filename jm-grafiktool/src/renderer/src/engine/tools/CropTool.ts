import type { Point, Rect, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import { rectFromPoints, snapRectToDoc } from '../geometry';
import { createCanvas } from '../canvas';
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

    // Precompute per-layer before/after geometry so undo/redo are O(1).
    const ops = doc.layers.map((layer) => {
      if (layer.kind === 'raster') {
        const oldCanvas = layer.canvas;
        const cropped = createCanvas(rect.width, rect.height);
        cropped.ctx.drawImage(oldCanvas, layer.offsetX - rect.x, layer.offsetY - rect.y);
        return {
          layer,
          oldCanvas,
          newCanvas: cropped.canvas,
          oldOffset: { x: layer.offsetX, y: layer.offsetY },
        };
      }
      return {
        layer,
        oldCanvas: null as HTMLCanvasElement | null,
        newCanvas: null as HTMLCanvasElement | null,
        oldOffset: { x: layer.offsetX, y: layer.offsetY },
      };
    });

    const apply = (): void => {
      doc.width = rect.width;
      doc.height = rect.height;
      for (const op of ops) {
        if (op.layer.kind === 'raster' && op.newCanvas) {
          op.layer.canvas = op.newCanvas;
          op.layer.offsetX = 0;
          op.layer.offsetY = 0;
        } else {
          op.layer.offsetX = op.oldOffset.x - rect.x;
          op.layer.offsetY = op.oldOffset.y - rect.y;
        }
      }
      doc.selection = null;
    };
    const revert = (): void => {
      doc.width = prevW;
      doc.height = prevH;
      for (const op of ops) {
        if (op.layer.kind === 'raster' && op.oldCanvas) {
          op.layer.canvas = op.oldCanvas;
        }
        op.layer.offsetX = op.oldOffset.x;
        op.layer.offsetY = op.oldOffset.y;
      }
    };

    apply();
    ctx.history.push(makeCommand('Freistellen (Crop)', apply, revert));
    ctx.layersChanged();
    ctx.requestRender();
  }
}
