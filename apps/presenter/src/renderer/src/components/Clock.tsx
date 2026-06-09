import { useEffect, useRef, useState } from 'react';
import { cn } from '@jm/ui';

function fmt(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

/** Wall clock + a presentation stopwatch with start/pause/reset. */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const startedRef = useRef<number>(Date.now());
  const baseRef = useRef<number>(0);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      if (running) setElapsed(baseRef.current + (Date.now() - startedRef.current) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const toggle = (): void => {
    if (running) {
      baseRef.current += (Date.now() - startedRef.current) / 1000;
      setRunning(false);
    } else {
      startedRef.current = Date.now();
      setRunning(true);
    }
  };
  const reset = (): void => {
    baseRef.current = 0;
    startedRef.current = Date.now();
    setElapsed(0);
  };

  const clock = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex items-center gap-4">
      <div className="text-right leading-none">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Uhrzeit</div>
        <div className="text-2xl font-bold tabular mt-0.5">{clock}</div>
      </div>
      <div className="text-right leading-none">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Laufzeit</div>
        <div className={cn('text-2xl font-bold tabular mt-0.5', running ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]')}>
          {fmt(elapsed)}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={toggle}
          className="h-6 px-2 rounded text-[11px] font-semibold border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--highlight)]"
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="h-6 px-2 rounded text-[11px] font-semibold border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--highlight)]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
