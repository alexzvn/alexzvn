import { useEffect, useRef } from 'react';
import {
  useStore,
  getCountdownRemaining,
  isCountdownRunning,
} from '@/store/timer';
import { useTick } from '@/lib/useTick';

/**
 * Operator-only controller that fires `tt:next` once the running countdown
 * has overshot by `autoAdvanceGraceSec`. Only one renderer (the operator
 * window) should run this hook so we don't get duplicate dispatches; the
 * fired-for-index ref also prevents firing twice on the same item even if
 * the server round-trip lags.
 */
export function useAutoAdvance(): void {
  const cd = useStore((s) => s.countdown);
  const tt = useStore((s) => s.timetable);
  const ttNext = useStore((s) => s.ttNext);
  const now = useTick();

  // Reset the guard whenever the active item changes (manual or auto).
  const lastFiredForIndex = useRef<number | null>(null);
  useEffect(() => {
    lastFiredForIndex.current = null;
  }, [tt.activeIndex]);

  const running = isCountdownRunning(cd);
  const remaining = getCountdownRemaining(cd, now);

  useEffect(() => {
    if (!tt.autoAdvance) return;
    if (!running) return;
    if (tt.activeIndex === null) return;
    if (tt.activeIndex >= tt.items.length - 1) return; // no next item
    if (lastFiredForIndex.current === tt.activeIndex) return;
    if (remaining > -tt.autoAdvanceGraceSec * 1000) return;

    lastFiredForIndex.current = tt.activeIndex;
    ttNext();
  }, [
    tt.autoAdvance,
    tt.autoAdvanceGraceSec,
    tt.activeIndex,
    tt.items.length,
    running,
    remaining,
    ttNext,
  ]);
}
