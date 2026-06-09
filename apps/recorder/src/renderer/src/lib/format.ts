export function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

/** Sekunden → "M:SS" bzw. "H:MM:SS". */
export function formatClock(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '–';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Linearer Spitzenpegel (0..1) → dBFS-Label. */
export function dbfsLabel(peak: number): string {
  if (peak <= 0) return '-∞';
  return (20 * Math.log10(peak)).toFixed(0);
}

/** Linearer Spitzenpegel (0..1) → Balkenbreite in % (Skala -60..0 dBFS). */
export function meterPct(peak: number): number {
  if (peak <= 0) return 0;
  const db = 20 * Math.log10(peak);
  const p = (db + 60) / 60;
  return Math.max(0, Math.min(1, p)) * 100;
}

/** Pegel-Farbe: grün / gelb (ab -6) / rot (ab -1, Clip-Nähe). */
export function meterColor(peak: number): string {
  const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  if (db >= -1) return 'var(--destructive)';
  if (db >= -6) return 'var(--warning)';
  return 'var(--success)';
}
