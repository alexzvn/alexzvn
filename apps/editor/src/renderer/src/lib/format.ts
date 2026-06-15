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

export function formatBytes(bytes: number): string {
  if (!bytes) return '–';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
