import { useEffect, useState } from 'react';

/** Re-rendert pro Animationsframe; liefert das aktuelle Date.now(). */
export function useTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return now;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** "HH:MM:SS" (mit Vorzeichen bei Overtime). */
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

/** Wanduhr "HH:MM:SS". */
export function formatClock(now: number): string {
  const d = new Date(now);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Uhrzeit "HH:MM" (für „Endet …"). */
export function formatWall(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
