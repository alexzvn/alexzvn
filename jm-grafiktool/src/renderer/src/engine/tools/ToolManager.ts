import type { ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import { BrushTool, EraserTool } from './PaintTools';
import { MoveTool } from './MoveTool';
import { HandTool, ZoomTool, EyedropperTool } from './NavTools';
import { MarqueeTool, LassoTool, MagicWandTool } from './SelectionTools';
import { FillTool } from './FillTool';
import { ShapeTool } from './ShapeTool';
import { TextTool } from './TextTool';
import { CropTool } from './CropTool';

/** Owns the tool instances and dispatches pointer events to the active one. */
export class ToolManager {
  private tools = new Map<ToolId, Tool>();
  private activeId: ToolId = 'brush';
  /** A transient override (e.g. space-bar Hand) takes precedence when set. */
  private overrideId: ToolId | null = null;

  constructor() {
    for (const tool of [
      new MoveTool(),
      new BrushTool(),
      new EraserTool(),
      new MarqueeTool(),
      new LassoTool(),
      new MagicWandTool(),
      new FillTool(),
      new ShapeTool(),
      new TextTool(),
      new CropTool(),
      new EyedropperTool(),
      new HandTool(),
      new ZoomTool(),
    ]) {
      this.tools.set(tool.id, tool);
    }
  }

  get active(): Tool {
    const id = this.overrideId ?? this.activeId;
    return this.tools.get(id) ?? this.tools.get('brush')!;
  }

  get activeToolId(): ToolId {
    return this.activeId;
  }

  setActive(id: ToolId): void {
    if (this.tools.has(id)) this.activeId = id;
  }

  setOverride(id: ToolId | null): void {
    this.overrideId = id;
  }

  cursor(ctx: ToolContext): string {
    return this.active.cursor?.(ctx) ?? 'default';
  }

  down(e: PointerInfo, ctx: ToolContext): void {
    this.active.onPointerDown(e, ctx);
  }
  move(e: PointerInfo, ctx: ToolContext): void {
    this.active.onPointerMove(e, ctx);
  }
  up(e: PointerInfo, ctx: ToolContext): void {
    this.active.onPointerUp(e, ctx);
  }
  leave(e: PointerInfo, ctx: ToolContext): void {
    this.active.onPointerLeave?.(e, ctx);
  }
  drawOverlay(o: Parameters<NonNullable<Tool['drawOverlay']>>[0], ctx: ToolContext): void {
    this.active.drawOverlay?.(o, ctx);
  }
}
