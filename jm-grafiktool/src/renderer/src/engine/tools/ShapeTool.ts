import type { Point, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import { rectFromPoints } from '../geometry';
import { createShapeLayer } from '../doc/Layer';
import { makeCommand } from '../history/commands';

const SHAPE_LABEL = { rectangle: 'Rechteck', ellipse: 'Ellipse', line: 'Linie' } as const;

/** Drag to create a vector shape layer (rectangle / ellipse / line). */
export class ShapeTool implements Tool {
  id: ToolId = 'shape';
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
    const isLine = ctx.options.shapeKind === 'line';
    const a = this.start;
    const b = e.doc;
    ctx.setPreview((o) => (isLine ? o.polyline([a, b], false) : o.dashedRect(rect)));
    ctx.requestRender();
  }

  onPointerUp(e: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    const start = this.start;
    this.start = null;
    ctx.setPreview(null);
    const opt = ctx.options;
    const isLine = opt.shapeKind === 'line';
    const rect = isLine
      ? { x: start.x, y: start.y, width: e.doc.x - start.x, height: e.doc.y - start.y }
      : rectFromPoints(start, e.doc);
    if (!isLine && (Math.abs(rect.width) < 2 || Math.abs(rect.height) < 2)) return;

    const layer = createShapeLayer(
      {
        shape: opt.shapeKind,
        fill: opt.shapeFill && !isLine ? { ...ctx.foreground } : null,
        stroke: opt.shapeStroke || isLine ? { ...ctx.foreground } : null,
        strokeWidth: opt.shapeStrokeWidth,
        // Bounds stored in local space; the layer offset places it in the doc.
        bounds: { x: 0, y: 0, width: rect.width, height: rect.height },
      },
      SHAPE_LABEL[opt.shapeKind],
    );
    layer.offsetX = rect.x;
    layer.offsetY = rect.y;

    const doc = ctx.doc;
    const at = doc.activeLayerId ? doc.indexOf(doc.activeLayerId) + 1 : doc.layers.length;
    ctx.history.push(
      makeCommand(
        `${SHAPE_LABEL[opt.shapeKind]} hinzufügen`,
        () => {
          doc.layers.splice(at, 0, layer);
          doc.activeLayerId = layer.id;
          ctx.layersChanged();
        },
        () => {
          doc.removeLayer(layer.id);
          ctx.layersChanged();
        },
      ),
    );
    doc.layers.splice(at, 0, layer);
    doc.activeLayerId = layer.id;
    ctx.layersChanged();
    ctx.requestRender();
  }
}
