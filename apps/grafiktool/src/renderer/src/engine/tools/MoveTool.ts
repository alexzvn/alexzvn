import type { Point, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import type { Layer } from '../doc/Layer';
import { makeCommand } from '../history/commands';

/** Move the active layer by adjusting its non-destructive offset. */
export class MoveTool implements Tool {
  id: ToolId = 'move';
  private layer: Layer | null = null;
  private start: Point | null = null;
  private origin = { x: 0, y: 0 };

  cursor(): string {
    return 'move';
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const layer = ctx.doc.activeLayer;
    if (!layer || layer.locked) return;
    this.layer = layer;
    this.start = e.doc;
    this.origin = { x: layer.offsetX, y: layer.offsetY };
  }

  onPointerMove(e: PointerInfo, ctx: ToolContext): void {
    if (!this.layer || !this.start) return;
    this.layer.offsetX = this.origin.x + (e.doc.x - this.start.x);
    this.layer.offsetY = this.origin.y + (e.doc.y - this.start.y);
    ctx.requestRender();
  }

  onPointerUp(_e: PointerInfo, ctx: ToolContext): void {
    if (!this.layer || !this.start) return;
    const layer = this.layer;
    const from = this.origin;
    const to = { x: layer.offsetX, y: layer.offsetY };
    this.layer = null;
    this.start = null;
    if (from.x === to.x && from.y === to.y) return;
    ctx.history.push(
      makeCommand(
        'Verschieben',
        () => {
          layer.offsetX = to.x;
          layer.offsetY = to.y;
        },
        () => {
          layer.offsetX = from.x;
          layer.offsetY = from.y;
        },
      ),
    );
    ctx.layersChanged();
  }
}
