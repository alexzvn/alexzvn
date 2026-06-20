import { cn } from '@jm/ui';
import {
  getCountdownRemaining,
  getProjectedEndMs,
  isCountdownPaused,
  isCountdownRunning,
  type TimerSource,
} from '@shared/types';
import { formatHMS, formatWall, useTick } from '@/lib/timer';

/**
 * Compact live-countdown strip for the presenter (speaker) view, fed by the JM
 * Timer over the LAN (#38). Hidden entirely until the timer connects; while the
 * countdown runs it ticks every frame and colours itself like the timer/stage
 * display (normal → warning → overtime).
 */
export function TimerBar({ timer }: { timer: TimerSource }) {
  const cd = timer.countdown;
  const active = Boolean(cd && (isCountdownRunning(cd) || isCountdownPaused(cd)));
  const now = useTick(active);

  const remaining = cd ? getCountdownRemaining(cd, now) : 0;
  const endsAt = cd ? getProjectedEndMs(cd, now) : null;
  const paused = Boolean(cd && isCountdownPaused(cd));

  const color = active
    ? remaining <= 0
      ? timer.colors.overtime
      : remaining <= timer.colors.warningAtSec * 1000
        ? timer.colors.warning
        : timer.colors.normal
    : '#ffffff';

  const message = timer.message.trim();

  return (
    <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-bold">
            JM Timer{paused ? ' · Pause' : ''}
          </div>
          {timer.activeLabel && (
            <div className="text-sm font-semibold truncate text-white/85">{timer.activeLabel}</div>
          )}
        </div>
        <div
          className={cn('font-extrabold leading-none tabular text-3xl', paused && 'opacity-70')}
          style={{ color }}
        >
          {active ? formatHMS(remaining) : '—:—'}
        </div>
      </div>

      {(active && endsAt != null) || message ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          {active && endsAt != null ? (
            <span className="uppercase tracking-[0.12em] text-white/45">
              Endet {formatWall(endsAt)}
            </span>
          ) : (
            <span />
          )}
          {message && (
            <span
              className={cn('font-semibold truncate', timer.blinking && 'jm-blink')}
              style={{ color: timer.blinking ? '#F61C56' : '#FFE819' }}
            >
              {message}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
