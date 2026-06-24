// Reiner Untertitel-Zeichner: rendert den aktuellen Text als transparenten
// Lower-Third-Caption auf einen Canvas (Programmauflösung). Wird sowohl für die
// Vorschau als auch — über getImageData → BGRA — für die NDI-Ausgabe genutzt.
// Keine React/Electron-Abhängigkeit, damit testbar/portabel.
import type { CaptionConfig } from '@shared/types';

/** Bricht `text` an Wortgrenzen so um, dass keine Zeile breiter als `maxWidth` ist. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxWidth) {
      out.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Zeichnet den Untertitel transparent auf `ctx` (Auflösung W×H). Leerer Text →
 * voll transparenter Frame (NDI-Empfänger sehen nichts). Der Text wird umgebrochen
 * und auf `cfg.ndiLines` Zeilen begrenzt (jüngster Teil bleibt sichtbar). Mit
 * `ndiBand` liegt ein halbtransparentes Band hinter dem Text (für nicht-keyende
 * Ziele); ohne Band sorgt eine Kontur für Lesbarkeit beim Keyen.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cfg: CaptionConfig,
  text: string,
): void {
  ctx.clearRect(0, 0, W, H);
  const trimmed = text.trim();
  if (!trimmed) return;

  const fs = cfg.ndiFontSize;
  ctx.font = `600 ${fs}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const maxWidth = W * 0.86;
  let rows = wrapLines(ctx, trimmed, maxWidth);
  const maxRows = Math.max(1, Math.round(cfg.ndiLines));
  if (rows.length > maxRows) rows = rows.slice(rows.length - maxRows);

  const lineH = fs * 1.28;
  const blockH = rows.length * lineH;
  const bottomMargin = H * 0.08;
  const cx = W / 2;
  // Baseline der ersten Zeile (Block sitzt unten, Margin vom unteren Rand).
  const baseY0 = H - bottomMargin - blockH + fs;

  if (cfg.ndiBand) {
    let textW = 0;
    for (const r of rows) textW = Math.max(textW, ctx.measureText(r).width);
    const padX = fs * 0.7;
    const padY = fs * 0.4;
    const boxW = Math.min(W, textW + padX * 2);
    const boxH = blockH + padY * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRectPath(ctx, cx - boxW / 2, H - bottomMargin - blockH - padY, boxW, boxH, fs * 0.18);
    ctx.fill();
  }

  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = Math.max(2, fs * 0.12);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < rows.length; i++) {
    const y = baseY0 + i * lineH;
    if (!cfg.ndiBand) ctx.strokeText(rows[i], cx, y);
    ctx.fillText(rows[i], cx, y);
  }
}
