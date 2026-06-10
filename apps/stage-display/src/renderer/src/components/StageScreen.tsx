import { cn } from '@jm/ui';
import {
  getCountdownRemaining,
  getProjectedEndMs,
  isCountdownPaused,
  isCountdownRunning,
  type StageState,
} from '@shared/types';
import { formatClock, formatHMS, formatWall } from '@/lib/format';

/**
 * Geteilte Bühnen-Darstellung — identisch in der Operator-Vorschau und im
 * Vollbild-Ausgabefenster. Skaliert über Container-Query-Einheiten (cqw/cqh)
 * automatisch auf die Größe des umgebenden Kastens.
 */
export function StageScreen({ state, now }: { state: StageState; now: number }) {
  const { config, timer, switcher } = state;
  const w = config.widgets;

  const cd = timer.countdown;
  const timerActive = Boolean(
    w.timer && timer.connected && cd && (isCountdownRunning(cd) || isCountdownPaused(cd)),
  );
  const remaining = cd ? getCountdownRemaining(cd, now) : 0;
  const endsAt = cd ? getProjectedEndMs(cd, now) : null;

  const color = timerActive
    ? remaining <= 0
      ? timer.colors.overtime
      : remaining <= timer.colors.warningAtSec * 1000
        ? timer.colors.warning
        : timer.colors.normal
    : '#ffffff';

  const adHoc = config.message.trim();
  const timerMsg = w.timer ? timer.message.trim() : '';
  const message = adHoc || timerMsg;
  const blinking = !adHoc && timer.blinking;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black text-white select-none"
      style={{ containerType: 'size' }}
    >
      {/* Uhr oben links */}
      {w.clock && (
        <div
          className="absolute left-[3%] top-[4%] font-extrabold text-white/80"
          style={{ fontSize: '4cqh', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatClock(now)}
        </div>
      )}

      {/* Switcher PGM oben rechts */}
      {w.switcher && switcher.connected && (
        <div className="absolute right-[3%] top-[4%] flex items-center gap-[1cqw]" style={{ fontSize: '2.4cqh' }}>
          <span className="rounded bg-white/12 px-[1.2cqh] py-[0.4cqh] font-extrabold">
            PGM {switcher.program || '–'}
          </span>
          {switcher.recording && (
            <span className="rounded px-[1.2cqh] py-[0.4cqh] font-extrabold" style={{ background: '#F61C56' }}>
              ● REC
            </span>
          )}
          {switcher.streaming && (
            <span className="rounded bg-amber-400 px-[1.2cqh] py-[0.4cqh] font-extrabold text-black">STREAM</span>
          )}
        </div>
      )}

      {/* Aktiver Programmpunkt oben mittig */}
      {w.timer && timer.activeLabel && (
        <div className="absolute inset-x-0 top-[16%] text-center px-[5%]">
          <div className="uppercase tracking-[0.14em] text-white/45" style={{ fontSize: '2.4cqh' }}>
            Programmpunkt
          </div>
          <div className="font-extrabold leading-tight" style={{ fontSize: '6cqh' }}>
            {timer.activeLabel}
          </div>
        </div>
      )}

      {/* Zentrales Element: Countdown (wenn Timer aktiv) sonst Uhr */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="font-extrabold leading-none"
          style={{ fontSize: 'min(26cqw, 40cqh)', color, fontVariantNumeric: 'tabular-nums' }}
        >
          {timerActive ? formatHMS(remaining) : formatClock(now)}
        </div>
      </div>

      {/* „Endet …" */}
      {timerActive && endsAt != null && (
        <div
          className="absolute inset-x-0 top-[68%] text-center uppercase tracking-[0.14em] text-white/55"
          style={{ fontSize: '2.8cqh' }}
        >
          Endet {formatWall(endsAt)}
        </div>
      )}

      {/* Nachricht */}
      {w.message && message && (
        <div
          className={cn('absolute inset-x-0 top-[76%] px-[5%] text-center font-extrabold', blinking && 'jm-blink')}
          style={{ fontSize: '4.5cqh', color: blinking ? '#F61C56' : '#FFE819', wordBreak: 'break-word' }}
        >
          {message}
        </div>
      )}

      {/* Up Next unten */}
      {w.timer && timer.nextLabel && (
        <div className="absolute inset-x-0 bottom-[5%] text-center px-[5%]">
          <div className="uppercase tracking-[0.14em] text-white/40" style={{ fontSize: '2cqh' }}>
            Up Next
          </div>
          <div className="truncate font-semibold text-white/85" style={{ fontSize: '3.4cqh' }}>
            {timer.nextLabel}
          </div>
        </div>
      )}
    </div>
  );
}
