import type { Command } from './History';
import type { Rect } from '../types';
import { createCanvas } from '../canvas';
import { snapRectToDoc } from '../geometry';

/** Generic command from two closures. */
export function makeCommand(label: string, redo: () => void, undo: () => void): Command {
  return { label, redo, undo };
}

/**
 * A raster patch command that snapshots only the dirty rectangle of a layer
 * canvas (before + after), keeping undo memory proportional to the edited area
 * rather than the whole document.
 *
 * @param beforeCanvas a full-canvas clone taken BEFORE the edit (transient; not
 *   retained — only the dirty rect is copied out of it).
 */
export function rasterPatchCommand(
  label: string,
  target: HTMLCanvasElement,
  beforeCanvas: HTMLCanvasElement,
  dirty: Rect,
): Command | null {
  const rect = snapRectToDoc(dirty, target.width, target.height);
  if (rect.width === 0 || rect.height === 0) return null;
  const ctx = target.getContext('2d')!;
  const beforeCtx = beforeCanvas.getContext('2d')!;
  const before = beforeCtx.getImageData(rect.x, rect.y, rect.width, rect.height);
  const after = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
  return {
    label,
    redo: () => ctx.putImageData(after, rect.x, rect.y),
    undo: () => ctx.putImageData(before, rect.x, rect.y),
  };
}

/** Snapshot the full canvas into a transient clone for before/after diffing. */
export function snapshot(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas: clone, ctx } = createCanvas(canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);
  return clone;
}
