import type { BrushSettings, Point, RGBA } from '../types';
import { rgbaToCss } from '../color';

/** Stamp spacing as a fraction of brush diameter (denser = smoother line). */
const SPACING = 0.2;

function applyStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: BrushSettings,
  color: RGBA | null,
): void {
  const r = brush.size / 2;
  if (r <= 0) return;
  ctx.save();
  ctx.globalAlpha = brush.opacity;
  if (color) {
    if (brush.hardness >= 1) {
      ctx.fillStyle = rgbaToCss(color);
    } else {
      const grad = ctx.createRadialGradient(x, y, r * brush.hardness, x, y, r);
      const solid = rgbaToCss(color);
      const clear = rgbaToCss({ ...color, a: 0 });
      grad.addColorStop(0, solid);
      grad.addColorStop(1, clear);
      ctx.fillStyle = grad;
    }
  } else {
    // Eraser: a white→transparent gradient combined with destination-out.
    if (brush.hardness >= 1) {
      ctx.fillStyle = '#fff';
    } else {
      const grad = ctx.createRadialGradient(x, y, r * brush.hardness, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
    }
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Paint a line of brush stamps from `from` to `to` on the layer context.
 * `color` null means erase (caller sets destination-out via `erase`).
 * `clip` (optional Path2D in the same coordinate space) limits painting.
 */
export function drawStampLine(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  brush: BrushSettings,
  color: RGBA | null,
  erase: boolean,
  clip: Path2D | null,
): void {
  ctx.save();
  if (clip) ctx.clip(clip);
  if (erase) ctx.globalCompositeOperation = 'destination-out';
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const step = Math.max(1, brush.size * SPACING);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    applyStamp(ctx, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, brush, color);
  }
  ctx.restore();
}
