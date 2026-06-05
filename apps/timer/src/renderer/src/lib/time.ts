export function formatHMS(ms: number): string {
  const negative = ms < 0;
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const body = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return negative ? `-${body}` : body;
}

export function parseHMS(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map((p) => p.trim());
  if (parts.length !== 3) return null;
  const [h, m, s] = parts.map(Number);
  if ([h, m, s].some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (m > 59 || s > 59) return null;
  return ((h * 3600 + m * 60 + s) * 1000);
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
