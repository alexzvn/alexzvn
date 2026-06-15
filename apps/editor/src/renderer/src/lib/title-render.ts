import type { TitleSpec } from '@shared/project';

// EINE Zeichenroutine für Titel/Bauchbinden — von Vorschau UND Export genutzt,
// damit beide identisch aussehen (Plan: Vorschau/Export-Parität). Gerendert wird
// immer in Sequenzauflösung; die Vorschau skaliert das Ergebnis nur per CSS.
const DESIGN_HEIGHT = 1080;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawTitle(ctx: CanvasRenderingContext2D, title: TitleSpec, W: number, H: number): void {
  const { style } = title;
  const scale = H / DESIGN_HEIGHT;
  const fs = style.fontSize * scale;
  const subFs = fs * 0.62;
  const pad = fs * 0.45;
  const gap = fs * 0.22;
  const weight = style.bold ? '700' : '500';
  const family = "'Manrope Variable', system-ui, sans-serif";

  ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${fs}px ${family}`;
  const titleW = ctx.measureText(title.text).width;
  ctx.font = `500 ${subFs}px ${family}`;
  const subW = title.subtitle ? ctx.measureText(title.subtitle).width : 0;

  const contentW = Math.max(titleW, subW);
  const lineH = fs * 1.15;
  const subLineH = title.subtitle ? subFs * 1.2 + gap : 0;
  const boxW = contentW + pad * 2;
  const boxH = lineH + subLineH + pad * 2;

  // Ankerpunkt: untere-linke Ecke der Box bei (x*W, y*H).
  const boxX = Math.round(style.x * W);
  const boxY = Math.round(style.y * H - boxH);

  if (style.background) {
    ctx.fillStyle = style.background;
    roundRect(ctx, boxX, boxY, boxW, boxH, fs * 0.18);
    ctx.fill();
  }

  ctx.fillStyle = style.color;
  ctx.font = `${weight} ${fs}px ${family}`;
  ctx.fillText(title.text, boxX + pad, boxY + pad + fs);

  if (title.subtitle) {
    ctx.fillStyle = style.color;
    ctx.globalAlpha = 0.85;
    ctx.font = `500 ${subFs}px ${family}`;
    ctx.fillText(title.subtitle, boxX + pad, boxY + pad + lineH + gap + subFs);
    ctx.globalAlpha = 1;
  }
}

/** Vollflächiges transparentes PNG (Sequenzauflösung) für den Export. */
export function titleDataUrl(title: TitleSpec, W: number, H: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawTitle(ctx, title, W, H);
  return canvas.toDataURL('image/png');
}
