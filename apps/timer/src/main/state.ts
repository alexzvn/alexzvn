import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  DEFAULT_COLORS,
  INITIAL_STATE,
  reduce,
  type Command,
  type SyncedState,
} from '@shared/timer-state';

let state: SyncedState = INITIAL_STATE;
const listeners = new Set<(s: SyncedState) => void>();

function statePath(): string {
  return path.join(app.getPath('userData'), 'state.json');
}

export function loadState(): void {
  try {
    const raw = fs.readFileSync(statePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SyncedState>;
    state = {
      countdown: {
        durationMs: parsed.countdown?.durationMs ?? INITIAL_STATE.countdown.durationMs,
        delayMs: 0,
        startedAtMs: null,
        pausedRemainingMs: null,
      },
      colors: { ...DEFAULT_COLORS, ...(parsed.colors ?? {}) },
      timetable: {
        items: Array.isArray(parsed.timetable?.items)
          ? parsed.timetable!.items
          : [],
        activeIndex: null,
        autoAdvance:
          typeof parsed.timetable?.autoAdvance === 'boolean'
            ? parsed.timetable.autoAdvance
            : INITIAL_STATE.timetable.autoAdvance,
        autoAdvanceGraceSec:
          typeof parsed.timetable?.autoAdvanceGraceSec === 'number'
            ? parsed.timetable.autoAdvanceGraceSec
            : INITIAL_STATE.timetable.autoAdvanceGraceSec,
      },
      message: {
        text: typeof parsed.message?.text === 'string' ? parsed.message.text : '',
        blinking: false,
      },
    };
  } catch {
    // first run or unreadable — keep defaults
  }
}

export function getState(): SyncedState {
  return state;
}

export function dispatch(cmd: Command): SyncedState {
  state = reduce(state, cmd);
  persist();
  for (const l of listeners) l(state);
  return state;
}

export function subscribe(fn: (s: SyncedState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function persist(): void {
  try {
    fs.writeFileSync(
      statePath(),
      JSON.stringify(
        {
          countdown: { durationMs: state.countdown.durationMs },
          colors: state.colors,
          timetable: {
            items: state.timetable.items,
            autoAdvance: state.timetable.autoAdvance,
            autoAdvanceGraceSec: state.timetable.autoAdvanceGraceSec,
          },
          message: { text: state.message.text },
        },
        null,
        2,
      ),
      'utf-8',
    );
  } catch {
    // disk errors must not crash the app
  }
}
