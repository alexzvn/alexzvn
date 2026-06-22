import { usToSec } from '@shared/project';

/** µs → "MM:SS.cc" (Timecode mit Hundertstel). */
export function formatTimecode(us: number): string {
  const sec = Math.max(0, usToSec(us));
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cc = Math.floor((sec - Math.floor(sec)) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

/** µs → "M:SS" (kompakt für Clip-Beschriftungen). */
export function formatShort(us: number): string {
  const sec = Math.max(0, usToSec(us));
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Linearer Gain → dB-Text fürs Fader-Label. */
export function formatDb(gain: number): string {
  if (gain <= 0) return '−∞';
  const db = 20 * Math.log10(gain);
  if (db >= 0) return `+${db.toFixed(1)}`;
  return db.toFixed(1);
}

/** Lineare Spitze (0..1) → dBFS-Text. */
export function formatDbfs(peak: number): string {
  if (peak <= 0) return '−∞';
  return `${(20 * Math.log10(peak)).toFixed(0)}`;
}

/** Pan (-1..+1) → Orientierungstext: L100 … 0 … R100. */
export function formatPan(pan: number): string {
  const v = Math.round(pan * 100);
  if (v === 0) return '0';
  return v < 0 ? `L${-v}` : `R${v}`;
}
