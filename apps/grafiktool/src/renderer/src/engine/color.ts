import type { RGBA } from './types';

/** Convert an RGBA color to a CSS `rgba(...)` string (alpha normalized to 0..1). */
export function rgbaToCss(c: RGBA): string {
  return `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${(c.a / 255).toFixed(4)})`;
}

/** Convert an RGBA color to `#rrggbb` (alpha dropped). */
export function rgbToHex(c: RGBA): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(c.r & 255)}${h(c.g & 255)}${h(c.b & 255)}`;
}

/** Parse `#rgb` / `#rrggbb` (with optional alpha) into RGBA. Falls back to opaque black. */
export function hexToRgba(hex: string, alpha = 255): RGBA {
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
  if (s.length === 6 || s.length === 8) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : alpha;
    if (![r, g, b, a].some(Number.isNaN)) return { r, g, b, a };
  }
  return { r: 0, g: 0, b: 0, a: alpha };
}

export function rgba(r: number, g: number, b: number, a = 255): RGBA {
  return { r, g, b, a };
}

/** Squared Euclidean distance in RGB space — cheap color-similarity metric. */
export function colorDistanceSq(a: RGBA, b: RGBA): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = a.a - b.a;
  return dr * dr + dg * dg + db * db + da * da;
}

export const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 255 };
export const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 255 };
export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };
