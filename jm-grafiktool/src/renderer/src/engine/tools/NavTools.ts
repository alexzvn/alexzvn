import type { Point, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';

/** Pan the viewport by dragging. */
export class HandTool implements Tool {
  id: ToolId = 'hand';
  private last: Point | null = null;

  cursor(): string {
    return this.last ? 'grabbing' : 'grab';
  }

  onPointerDown(e: PointerInfo): void {
    this.last = e.screen;
  }

  onPointerMove(e: PointerInfo, ctx: ToolContext): void {
    if (!this.last) return;
    ctx.viewport.pan(e.screen.x - this.last.x, e.screen.y - this.last.y);
    this.last = e.screen;
    ctx.requestRender();
  }

  onPointerUp(): void {
    this.last = null;
  }

  onPointerLeave(): void {
    this.last = null;
  }
}

/** Click to zoom in; Alt-click to zoom out (centered on the cursor). */
export class ZoomTool implements Tool {
  id: ToolId = 'zoom';

  cursor(): string {
    return 'zoom-in';
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const factor = e.alt ? 1 / 1.4 : 1.4;
    ctx.viewport.zoomAt(e.screen, factor);
    ctx.requestRender();
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}

/** Pick the flattened color under the cursor into the foreground swatch. */
export class EyedropperTool implements Tool {
  id: ToolId = 'eyedropper';

  cursor(): string {
    return 'crosshair';
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const c = ctx.sampleComposite(Math.floor(e.doc.x), Math.floor(e.doc.y));
    if (c.a > 0) ctx.setForeground({ ...c, a: 255 });
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}
