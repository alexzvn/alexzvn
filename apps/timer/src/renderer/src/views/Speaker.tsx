import { useEffect, useState } from 'react';
import {
  useStore,
  getCountdownRemaining,
  getProjectedEndMs,
  isCountdownPaused,
  isCountdownRunning,
} from '@/store/timer';
import { useTick } from '@/lib/useTick';
import { formatHMS } from '@/lib/time';
import { TimerDisplay } from '@/components/TimerDisplay';
import { Logo } from '@jm/ui';
import { cn } from '@jm/ui';

export function SpeakerView() {
  const cd = useStore((s) => s.countdown);
  const tt = useStore((s) => s.timetable);
  const message = useStore((s) => s.message);
  const connected = useStore((s) => s.connected);
  const now = useTick();

  const running = isCountdownRunning(cd);
  const paused = isCountdownPaused(cd);
  const countdownActive = running || paused;

  const remaining = getCountdownRemaining(cd, now);
  const endsAt = getProjectedEndMs(cd, now);

  const d = new Date(now);
  const wallMs = ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000;

  const showMs = countdownActive ? remaining : wallMs;
  const reactive = countdownActive;

  const activeItem =
    tt.activeIndex !== null ? tt.items[tt.activeIndex] : null;
  const nextItem =
    tt.activeIndex !== null && tt.activeIndex + 1 < tt.items.length
      ? tt.items[tt.activeIndex + 1]
      : null;

  const hasElectronFs = typeof window !== 'undefined' && !!window.jm?.speaker;

  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (hasElectronFs) {
      window.jm!.speaker.isFullscreen().then((v) => {
        if (!cancelled) setIsFs(v);
      });
      return () => {
        cancelled = true;
      };
    }
    // Browser context (Remote view) — react to native fullscreenchange
    const sync = () => {
      if (!cancelled) setIsFs(!!document.fullscreenElement);
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => {
      cancelled = true;
      document.removeEventListener('fullscreenchange', sync);
    };
  }, [hasElectronFs]);

  async function toggleFullscreen() {
    if (hasElectronFs) {
      const next = !isFs;
      await window.jm!.speaker.setFullscreen(next);
      setIsFs(next);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--background)] relative overflow-hidden select-none">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64
                   bg-gradient-to-b from-[var(--highlight)] to-transparent opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px
                   bg-gradient-to-r from-transparent via-[var(--primary)]/40 to-transparent"
      />

      <div className="absolute top-6 left-8 flex items-center gap-3">
        <Logo size={36} />
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span className="text-[var(--slash)] mr-2">/</span>
          {countdownActive ? (running ? 'Live' : 'Paused') : 'Real-Time'}
        </span>
      </div>

      <div className="absolute top-6 right-8 flex items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-0.5',
            'text-[10px] uppercase tracking-[0.14em] font-extrabold border',
            connected
              ? 'border-[var(--primary)]/40 text-[var(--primary)]'
              : 'border-[var(--destructive)]/60 text-[var(--destructive)]',
          )}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: connected ? 'var(--primary)' : 'var(--destructive)' }}
          />
          {connected ? 'Sync' : 'Offline'}
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          {isFs ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {activeItem && (
        <div className="absolute top-24 left-0 right-0 px-12 text-center">
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-2">
            #{String((tt.activeIndex ?? 0) + 1).padStart(2, '0')} ·
            Programmpunkt
          </div>
          <div className="text-2xl md:text-4xl font-extrabold tracking-tight">
            {activeItem.label}
          </div>
        </div>
      )}

      <TimerDisplay ms={showMs} reactive={reactive} size="fullscreen" />

      <div className="mt-8 flex items-center gap-10 text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)] flex-wrap justify-center px-12">
        {countdownActive && activeItem && (
          <span>
            <span className="text-[var(--slash)] mr-2">/</span>
            Plan {formatHMS(activeItem.durationMs)}
          </span>
        )}
        {countdownActive && !activeItem && (
          <span>
            <span className="text-[var(--slash)] mr-2">/</span>
            Plan {formatHMS(cd.durationMs)}
          </span>
        )}
        {countdownActive && endsAt !== null && (
          <span>
            <span className="text-[var(--slash)] mr-2">/</span>
            Endet {formatWallClock(endsAt)}
          </span>
        )}
        {cd.delayMs !== 0 && (
          <span
            style={{
              color: cd.delayMs > 0 ? 'var(--destructive)' : 'var(--primary)',
            }}
            className="font-extrabold"
          >
            <span className="mr-2">/</span>
            Delay {cd.delayMs > 0 ? '+' : '−'}
            {formatHMS(Math.abs(cd.delayMs))}
          </span>
        )}
      </div>

      {message.text.trim() !== '' && (
        <div className="mt-10 max-w-[80vw] px-8">
          <div
            className={cn(
              'text-center font-extrabold leading-tight',
              'tracking-tight',
              message.blinking && 'jm-blink',
            )}
            style={{
              color: message.blinking
                ? 'var(--destructive)'
                : 'var(--primary)',
              fontSize: 'clamp(1.5rem, 4vw, 3.5rem)',
              wordBreak: 'break-word',
            }}
          >
            {message.text}
          </div>
        </div>
      )}

      {nextItem && (
        <div className="absolute bottom-8 left-0 right-0 px-12 text-center">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-1">
            Up Next
          </div>
          <div className="text-lg font-semibold text-[var(--foreground)]/85 truncate">
            {nextItem.label}
            <span className="text-[var(--muted-foreground)] ml-3 text-sm font-normal tabular">
              {formatHMS(nextItem.durationMs)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatWallClock(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
