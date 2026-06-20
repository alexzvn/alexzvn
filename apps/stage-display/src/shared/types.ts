// --- Timer-Countdown-Teilmenge (kopiert aus apps/timer/src/shared/timer-state.ts,
//     nur was der Bühnenschirm zum Live-Ticken braucht — keine App-Kopplung). ---

export interface CountdownState {
  durationMs: number;
  delayMs: number;
  startedAtMs: number | null;
  pausedRemainingMs: number | null;
}

export function effectiveDurationMs(cd: CountdownState): number {
  return cd.durationMs + cd.delayMs;
}
export function getCountdownRemaining(cd: CountdownState, now: number = Date.now()): number {
  if (cd.startedAtMs !== null) return effectiveDurationMs(cd) - (now - cd.startedAtMs);
  if (cd.pausedRemainingMs !== null) return cd.pausedRemainingMs;
  return effectiveDurationMs(cd);
}
export function getProjectedEndMs(cd: CountdownState, now: number = Date.now()): number | null {
  if (cd.startedAtMs !== null) return cd.startedAtMs + effectiveDurationMs(cd);
  if (cd.pausedRemainingMs !== null) return now + cd.pausedRemainingMs;
  return null;
}
export function isCountdownRunning(cd: CountdownState): boolean {
  return cd.startedAtMs !== null;
}
export function isCountdownPaused(cd: CountdownState): boolean {
  return cd.startedAtMs === null && cd.pausedRemainingMs !== null;
}

// --- Aggregierter Bühnen-State (gehört dem Main-Prozess) ---

/** Farb-Schwellen des Timers (für originalgetreue Countdown-Farben). */
export interface ColorConfig {
  normal: string;
  warning: string;
  overtime: string;
  /** Sekunden-Schwelle normal → warning. */
  warningAtSec: number;
}

export const DEFAULT_COLORS: ColorConfig = {
  normal: '#FFE819',
  warning: '#FFB81C',
  overtime: '#F61C56',
  warningAtSec: 60,
};

export interface TimerSource {
  connected: boolean;
  /** Roher Countdown (für live Tick im Renderer); null = unbekannt. */
  countdown: CountdownState | null;
  activeLabel: string | null;
  nextLabel: string | null;
  colors: ColorConfig;
  /** Nachricht aus dem Timer (Speaker-Message). */
  message: string;
  blinking: boolean;
}

export interface SwitcherSource {
  connected: boolean;
  program: number;
  preview: number;
  recording: boolean;
  streaming: boolean;
  scenes: number;
}

/** Audience screen mode reported by the presenter (black/white pause screen). */
export type PresenterScreen = 'live' | 'black' | 'white';

/**
 * Live reference view fed from JM Presenter over the LAN (#38). Mirrors the
 * compact view the presenter's network remote already broadcasts via SSE
 * (`/events`): current slide title + notes, next title and position. Slice 2a is
 * text-only; the slide image follows in slice 2b over the same channel.
 */
export interface PresenterSource {
  connected: boolean;
  /** A presentation is currently running. */
  active: boolean;
  index: number; // 0-based slide index
  total: number;
  title: string;
  notes: string;
  nextTitle: string | null;
  screen: PresenterScreen;
}

export interface StageConfig {
  timer: { enabled: boolean; host: string; port: number };
  switcher: { enabled: boolean; host: string; port: number };
  /** JM Presenter feed (Referentenansicht). `pin` only needed if the presenter
   *  remote runs with a PIN; leave empty to connect to a PIN-less remote. */
  presenter: { enabled: boolean; host: string; port: number; pin: string };
  widgets: { clock: boolean; timer: boolean; switcher: boolean; message: boolean; presenter: boolean };
  /** Ad-hoc-Nachricht, die der Operator auf dem Bühnenschirm einblendet. */
  message: string;
  /** Gewählter Ausgabe-Bildschirm (null = primär). */
  outputDisplayId: number | null;
}

export interface StageState {
  config: StageConfig;
  timer: TimerSource;
  switcher: SwitcherSource;
  presenter: PresenterSource;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

/** Shape, die der Preload auf `window.jmstage` legt. */
export interface JmstageApi {
  platform: NodeJS.Platform;
  getState: () => Promise<StageState>;
  /** Konfiguration (teilweise) ändern; liefert den neuen Gesamt-State. */
  setConfig: (patch: PartialStageConfig) => Promise<StageState>;
  onState: (cb: (s: StageState) => void) => () => void;
  output: {
    displays: () => Promise<DisplayInfo[]>;
    open: (displayId?: number) => Promise<void>;
    close: () => Promise<void>;
    isOpen: () => Promise<boolean>;
  };
}

/** Teil-Update der Konfiguration (verschachtelte Objekte werden in Main gemerged). */
export interface PartialStageConfig {
  timer?: Partial<StageConfig['timer']>;
  switcher?: Partial<StageConfig['switcher']>;
  presenter?: Partial<StageConfig['presenter']>;
  widgets?: Partial<StageConfig['widgets']>;
  message?: string;
  outputDisplayId?: number | null;
}
