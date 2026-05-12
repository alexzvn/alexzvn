import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Mode = 'clock' | 'countdown' | 'timetable' | 'settings';

export interface ColorConfig {
  /** color while remaining > warningAtSec */
  normal: string;
  /** color while remaining <= warningAtSec but > 0 */
  warning: string;
  /** color while remaining <= 0 (overtime) */
  overtime: string;
  /** seconds threshold for switching normal → warning */
  warningAtSec: number;
}

export interface CountdownState {
  /** Planned duration (HH:MM:SS the operator configured). */
  durationMs: number;
  /** Live delay applied on top of `durationMs`. Positive = later, negative = ahead. */
  delayMs: number;
  /** Wall-clock at which the countdown was started (null when not running). */
  startedAtMs: number | null;
  /** Frozen remaining ms when paused (null when not paused). Includes accumulated delay. */
  pausedRemainingMs: number | null;
}

export interface AppState {
  mode: Mode;
  countdown: CountdownState;
  colors: ColorConfig;

  setMode: (mode: Mode) => void;
  setCountdownDuration: (ms: number) => void;
  startCountdown: () => void;
  pauseCountdown: () => void;
  resetCountdown: () => void;
  /** Add a delay in **seconds**. Positive = später, negative = früher. */
  addDelay: (deltaSec: number) => void;
  clearDelay: () => void;
  setColors: (patch: Partial<ColorConfig>) => void;
}

const DEFAULT_COLORS: ColorConfig = {
  normal: '#FFE819',
  warning: '#FFB81C',
  overtime: '#F61C56',
  warningAtSec: 60,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'clock',
      countdown: {
        durationMs: 5 * 60 * 1000,
        delayMs: 0,
        startedAtMs: null,
        pausedRemainingMs: null,
      },
      colors: { ...DEFAULT_COLORS },

      setMode: (mode) => set({ mode }),

      setCountdownDuration: (durationMs) =>
        set(() => ({
          countdown: {
            durationMs,
            delayMs: 0,
            startedAtMs: null,
            pausedRemainingMs: null,
          },
        })),

      startCountdown: () =>
        set((s) => {
          const cd = s.countdown;
          if (cd.startedAtMs !== null) return s;
          const effective = cd.durationMs + cd.delayMs;
          if (cd.pausedRemainingMs !== null) {
            // resume — pretend it started in the past so the remaining matches
            const fakeStart = Date.now() - (effective - cd.pausedRemainingMs);
            return {
              countdown: {
                durationMs: cd.durationMs,
                delayMs: cd.delayMs,
                startedAtMs: fakeStart,
                pausedRemainingMs: null,
              },
            };
          }
          return {
            countdown: {
              durationMs: cd.durationMs,
              delayMs: cd.delayMs,
              startedAtMs: Date.now(),
              pausedRemainingMs: null,
            },
          };
        }),

      pauseCountdown: () =>
        set((s) => {
          const cd = s.countdown;
          if (cd.startedAtMs === null) return s;
          const elapsed = Date.now() - cd.startedAtMs;
          const remaining = cd.durationMs + cd.delayMs - elapsed;
          return {
            countdown: {
              durationMs: cd.durationMs,
              delayMs: cd.delayMs,
              startedAtMs: null,
              pausedRemainingMs: remaining,
            },
          };
        }),

      resetCountdown: () =>
        set((s) => ({
          countdown: {
            durationMs: s.countdown.durationMs,
            delayMs: 0,
            startedAtMs: null,
            pausedRemainingMs: null,
          },
        })),

      addDelay: (deltaSec) =>
        set((s) => {
          const cd = s.countdown;
          const deltaMs = Math.round(deltaSec * 1000);
          // Update frozen remaining if paused, so the timer reflects the delay on resume
          const nextPaused =
            cd.pausedRemainingMs !== null ? cd.pausedRemainingMs + deltaMs : null;
          return {
            countdown: {
              durationMs: cd.durationMs,
              delayMs: cd.delayMs + deltaMs,
              startedAtMs: cd.startedAtMs,
              pausedRemainingMs: nextPaused,
            },
          };
        }),

      clearDelay: () =>
        set((s) => {
          const cd = s.countdown;
          if (cd.delayMs === 0) return s;
          // Reverse-apply current delay to paused remaining so the display stays consistent
          const nextPaused =
            cd.pausedRemainingMs !== null ? cd.pausedRemainingMs - cd.delayMs : null;
          return {
            countdown: {
              durationMs: cd.durationMs,
              delayMs: 0,
              startedAtMs: cd.startedAtMs,
              pausedRemainingMs: nextPaused,
            },
          };
        }),

      setColors: (patch) =>
        set((s) => ({ colors: { ...s.colors, ...patch } })),
    }),
    {
      name: 'jm-timer:v1',
      partialize: (s) => ({
        colors: s.colors,
        countdown: {
          durationMs: s.countdown.durationMs,
          delayMs: 0,
          startedAtMs: null,
          pausedRemainingMs: null,
        },
        mode: s.mode,
      }),
    },
  ),
);

export function effectiveDurationMs(cd: CountdownState): number {
  return cd.durationMs + cd.delayMs;
}

export function getCountdownRemaining(cd: CountdownState, now: number = Date.now()): number {
  if (cd.startedAtMs !== null) {
    return effectiveDurationMs(cd) - (now - cd.startedAtMs);
  }
  if (cd.pausedRemainingMs !== null) {
    return cd.pausedRemainingMs;
  }
  return effectiveDurationMs(cd);
}

/** Projected wall-clock ms at which the timer hits zero. Null when idle. */
export function getProjectedEndMs(cd: CountdownState, now: number = Date.now()): number | null {
  if (cd.startedAtMs !== null) {
    return cd.startedAtMs + effectiveDurationMs(cd);
  }
  if (cd.pausedRemainingMs !== null) {
    return now + cd.pausedRemainingMs;
  }
  return null;
}

export function isCountdownRunning(cd: CountdownState): boolean {
  return cd.startedAtMs !== null;
}

export function isCountdownPaused(cd: CountdownState): boolean {
  return cd.startedAtMs === null && cd.pausedRemainingMs !== null;
}
