// ─────────────────────────────────────────────────────────────────────────────
// Capability-Tabelle je Tool-Rolle. Rein deklarativ (keine node/electron-
// Imports), damit sie — wie ./index — ins standalone Companion-Modul kopiert
// werden kann (scripts/sync-companion-protocol.mjs). Das generische „JM Suite"-
// Companion-Modul iteriert diese Tabelle und baut daraus setActionDefinitions /
// setFeedbackDefinitions / setVariableDefinitions je gefundener Rolle.
//
// Dient gleichzeitig als maschinenlesbare Doku, welche Befehle/Status ein Tool
// über @jm/suite-control-protocol spricht.
// ─────────────────────────────────────────────────────────────────────────────

export type ArgType = 'number' | 'string' | 'dropdown';

export interface CapabilityArg {
  /** Option-ID im Companion + Reihenfolge im Befehl (Token nach dem Verb). */
  id: string;
  label: string;
  type: ArgType;
  default?: number | string;
  min?: number;
  max?: number;
  choices?: { id: string; label: string }[];
}

export interface CapabilityAction {
  /** Rollen-lokale, stabile ID (z. B. 'preview'); Companion-Action-ID = `${role}.${id}`. */
  id: string;
  label: string;
  /** Protokoll-Verb (z. B. 'preview', 'start', 'cue'). */
  verb: string;
  /** Argumente in Reihenfolge → Token nach dem Verb. */
  args?: CapabilityArg[];
  /**
   * Wenn gesetzt: Toggle-Action. Der Wert ist ein dropdown-Arg mit
   * Choices on/off/toggle; das Modul löst 'toggle' anhand des STATE-Schlüssels
   * `toggleKey` auf (an↔aus). Beispiel: Switcher RECORD/STREAM.
   */
  toggleKey?: string;
}

export interface CapabilityVariable {
  /** Schlüssel im STATE-Push (z. B. 'program', 'remaining'). */
  id: string;
  label: string;
}

export type RGB = [number, number, number];

export interface CapabilityFeedback {
  id: string;
  label: string;
  /** STATE-Schlüssel, der ausgewertet wird. */
  stateKey: string;
  /**
   *  'truthy'     → an, wenn Schlüssel '1'/true ist (z. B. recording).
   *  'equalsArg'  → an, wenn Schlüssel == Optionswert (z. B. program == Szene n).
   */
  match: 'truthy' | 'equalsArg';
  arg?: CapabilityArg;
  bgcolor: RGB;
  color: RGB;
}

export interface RoleCapability {
  role: string;
  label: string;
  /** Standard-Steuerport (mDNS liefert den realen Port; dies ist nur der Default). */
  port: number;
  actions: CapabilityAction[];
  variables: CapabilityVariable[];
  feedbacks: CapabilityFeedback[];
}

const RED: RGB = [200, 30, 30];
const GREEN: RGB = [30, 160, 60];
const YELLOW: RGB = [251, 231, 59];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

const sceneArg: CapabilityArg = { id: 'scene', label: 'Szene (Nr.)', type: 'number', default: 1, min: 1, max: 64 };
const modeArg: CapabilityArg = {
  id: 'mode',
  label: 'Modus',
  type: 'dropdown',
  default: 'toggle',
  choices: [
    { id: 'toggle', label: 'Umschalten' },
    { id: 'on', label: 'Start' },
    { id: 'off', label: 'Stopp' },
  ],
};

export const CAPABILITIES: Record<string, RoleCapability> = {
  // ── Switcher (Bestand; Verben ohne Namespace) ──────────────────────────────
  switcher: {
    role: 'switcher',
    label: 'JM Switcher',
    port: 8723,
    actions: [
      { id: 'preview', label: 'Preview-Szene wählen', verb: 'preview', args: [sceneArg] },
      { id: 'program', label: 'Program-Szene (harter Schnitt)', verb: 'program', args: [sceneArg] },
      { id: 'cut', label: 'Cut (Program = Preview)', verb: 'cut' },
      {
        id: 'auto',
        label: 'Auto (Dissolve)',
        verb: 'auto',
        args: [{ id: 'ms', label: 'Dauer ms (0 = Standard)', type: 'number', default: 0, min: 0, max: 10000 }],
      },
      { id: 'record', label: 'Aufnahme', verb: 'record', args: [modeArg], toggleKey: 'recording' },
      { id: 'stream', label: 'Stream (RTMP)', verb: 'stream', args: [modeArg], toggleKey: 'streaming' },
    ],
    variables: [
      { id: 'program', label: 'Program-Szene (Nr.)' },
      { id: 'preview', label: 'Preview-Szene (Nr.)' },
      { id: 'recording', label: 'Aufnahme (1/0)' },
      { id: 'streaming', label: 'Stream (1/0)' },
      { id: 'scenes', label: 'Anzahl Szenen' },
    ],
    feedbacks: [
      { id: 'program_scene', label: 'Szene ist auf Program', stateKey: 'program', match: 'equalsArg', arg: sceneArg, bgcolor: RED, color: WHITE },
      { id: 'preview_scene', label: 'Szene ist auf Preview', stateKey: 'preview', match: 'equalsArg', arg: sceneArg, bgcolor: GREEN, color: WHITE },
      { id: 'recording', label: 'Aufnahme läuft', stateKey: 'recording', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'streaming', label: 'Stream läuft', stateKey: 'streaming', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },

  // ── Timer ──────────────────────────────────────────────────────────────────
  timer: {
    role: 'timer',
    label: 'JM Timer',
    port: 8724,
    actions: [
      { id: 'start', label: 'Start', verb: 'start' },
      { id: 'stop', label: 'Stopp', verb: 'stop' },
      { id: 'reset', label: 'Reset', verb: 'reset' },
      { id: 'add', label: 'Zeit addieren (s)', verb: 'add', args: [{ id: 'seconds', label: 'Sekunden', type: 'number', default: 30, min: -3600, max: 3600 }] },
      { id: 'set', label: 'Zeit setzen (s)', verb: 'set', args: [{ id: 'seconds', label: 'Sekunden', type: 'number', default: 300, min: 0, max: 86400 }] },
      { id: 'goto', label: 'Block anspringen', verb: 'goto', args: [{ id: 'block', label: 'Block (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
    ],
    variables: [
      { id: 'remaining', label: 'Restzeit (mm:ss)' },
      { id: 'remaining_s', label: 'Restzeit (Sekunden)' },
      { id: 'running', label: 'Läuft (1/0)' },
      { id: 'block_label', label: 'Aktueller Block' },
    ],
    feedbacks: [
      { id: 'running', label: 'Timer läuft', stateKey: 'running', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'overrun', label: 'Timer überzogen', stateKey: 'overrun', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'warning', label: 'Timer-Warnung', stateKey: 'warning', match: 'truthy', bgcolor: YELLOW, color: BLACK },
    ],
  },

  // ── Player (Soundboard/Cues) ────────────────────────────────────────────────
  player: {
    role: 'player',
    label: 'JM Player',
    port: 8725,
    actions: [
      { id: 'go', label: 'GO (Standby-Cue feuern)', verb: 'go' },
      { id: 'stop', label: 'Stopp (alle Cues)', verb: 'stop' },
      { id: 'pause', label: 'Pause/Resume', verb: 'pause' },
      { id: 'panic', label: 'Panic (Hard-Stop)', verb: 'panic' },
      { id: 'cue', label: 'Show-Cue feuern', verb: 'cue', args: [{ id: 'n', label: 'Cue (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
      { id: 'standby', label: 'Standby setzen', verb: 'standby', args: [{ id: 'n', label: 'Cue (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
      { id: 'next', label: 'Standby +1', verb: 'next' },
      { id: 'prev', label: 'Standby −1', verb: 'prev' },
      { id: 'pad', label: 'Soundboard-Pad triggern', verb: 'pad', args: [{ id: 'slot', label: 'Pad (Slot)', type: 'number', default: 0, min: 0, max: 99 }] },
    ],
    variables: [
      { id: 'playing', label: 'Spielt (1/0)' },
      { id: 'paused', label: 'Pausiert (1/0)' },
      { id: 'standby', label: 'Standby-Cue (Nr.)' },
      { id: 'standby_label', label: 'Standby-Titel' },
      { id: 'cues', label: 'Anzahl Cues' },
      { id: 'playing_count', label: 'Laufende Cues' },
    ],
    feedbacks: [
      { id: 'playing', label: 'Player spielt', stateKey: 'playing', match: 'truthy', bgcolor: GREEN, color: WHITE },
      { id: 'paused', label: 'Player pausiert', stateKey: 'paused', match: 'truthy', bgcolor: YELLOW, color: BLACK },
      { id: 'standby_cue', label: 'Cue ist auf Standby', stateKey: 'standby', match: 'equalsArg', arg: { id: 'n', label: 'Cue (Nr.)', type: 'number', default: 1, min: 1, max: 999 }, bgcolor: GREEN, color: WHITE },
    ],
  },

  // ── Titler (Bauchbinden) ────────────────────────────────────────────────────
  titler: {
    role: 'titler',
    label: 'JM Titler',
    port: 8726,
    actions: [
      { id: 'take', label: 'Bauchbinde einblenden (Take)', verb: 'take', args: [{ id: 'n', label: 'Bauchbinde (Nr.)', type: 'number', default: 1, min: 1, max: 99 }] },
      { id: 'clear', label: 'Ausblenden (Clear)', verb: 'clear' },
      { id: 'next', label: 'Nächste', verb: 'next' },
      { id: 'prev', label: 'Vorherige', verb: 'prev' },
      { id: 'toggle', label: 'Umschalten On-Air', verb: 'toggle', args: [modeArg], toggleKey: 'on_air' },
    ],
    variables: [
      { id: 'active', label: 'Aktive Bauchbinde (Nr.)' },
      { id: 'active_label', label: 'Aktive Bauchbinde (Text)' },
      { id: 'on_air', label: 'On-Air (1/0)' },
    ],
    feedbacks: [
      { id: 'on_air', label: 'Bauchbinde On-Air', stateKey: 'on_air', match: 'truthy', bgcolor: RED, color: WHITE },
      { id: 'active', label: 'Bauchbinde ist aktiv', stateKey: 'active', match: 'equalsArg', arg: { id: 'n', label: 'Bauchbinde (Nr.)', type: 'number', default: 1, min: 1, max: 99 }, bgcolor: RED, color: WHITE },
    ],
  },

  // ── Prompter ────────────────────────────────────────────────────────────────
  prompter: {
    role: 'prompter',
    label: 'JM Prompter',
    port: 8727,
    actions: [
      { id: 'scroll', label: 'Scrollen', verb: 'scroll', args: [modeArg], toggleKey: 'scrolling' },
      { id: 'speed', label: 'Tempo setzen', verb: 'speed', args: [{ id: 'value', label: 'Tempo', type: 'number', default: 10, min: 0, max: 100 }] },
      { id: 'faster', label: 'Schneller', verb: 'faster' },
      { id: 'slower', label: 'Langsamer', verb: 'slower' },
      { id: 'top', label: 'An den Anfang', verb: 'top' },
      { id: 'goto', label: 'Zu Marke springen', verb: 'goto', args: [{ id: 'marker', label: 'Marke', type: 'string', default: '1' }] },
    ],
    variables: [
      { id: 'speed', label: 'Tempo' },
      { id: 'scrolling', label: 'Scrollt (1/0)' },
      { id: 'position_pct', label: 'Position (%)' },
    ],
    feedbacks: [{ id: 'scrolling', label: 'Prompter scrollt', stateKey: 'scrolling', match: 'truthy', bgcolor: GREEN, color: WHITE }],
  },

  // ── Presenter ───────────────────────────────────────────────────────────────
  presenter: {
    role: 'presenter',
    label: 'JM Presenter',
    port: 8728,
    actions: [
      { id: 'next', label: 'Nächste Folie', verb: 'next' },
      { id: 'prev', label: 'Vorherige Folie', verb: 'prev' },
      { id: 'goto', label: 'Folie anspringen', verb: 'goto', args: [{ id: 'n', label: 'Folie (Nr.)', type: 'number', default: 1, min: 1, max: 999 }] },
      { id: 'black', label: 'Schwarz', verb: 'black' },
      { id: 'white', label: 'Weiß', verb: 'white' },
      { id: 'live', label: 'Live', verb: 'live' },
    ],
    variables: [
      { id: 'slide', label: 'Aktuelle Folie' },
      { id: 'total', label: 'Folien gesamt' },
    ],
    feedbacks: [
      { id: 'black', label: 'Schwarzbild aktiv', stateKey: 'black', match: 'truthy', bgcolor: BLACK, color: WHITE },
      { id: 'live', label: 'Live aktiv', stateKey: 'live', match: 'truthy', bgcolor: GREEN, color: WHITE },
    ],
  },

  // ── Recorder ────────────────────────────────────────────────────────────────
  recorder: {
    role: 'recorder',
    label: 'JM Audio Recorder',
    port: 8729,
    actions: [
      { id: 'record', label: 'Aufnahme', verb: 'record', args: [modeArg], toggleKey: 'recording' },
      { id: 'mark', label: 'Marker setzen', verb: 'mark' },
    ],
    variables: [
      { id: 'recording', label: 'Aufnahme (1/0)' },
      { id: 'duration', label: 'Dauer' },
      { id: 'file', label: 'Datei' },
    ],
    feedbacks: [{ id: 'recording', label: 'Aufnahme läuft', stateKey: 'recording', match: 'truthy', bgcolor: RED, color: WHITE }],
  },

  // ── DAW (Transport, minimal) ────────────────────────────────────────────────
  daw: {
    role: 'daw',
    label: 'JM DAW',
    port: 8730,
    actions: [
      { id: 'play', label: 'Play', verb: 'play' },
      { id: 'stop', label: 'Stopp', verb: 'stop' },
      { id: 'rec', label: 'Aufnahme', verb: 'rec', args: [modeArg], toggleKey: 'recording' },
      { id: 'mark', label: 'Marker setzen', verb: 'mark' },
    ],
    variables: [
      { id: 'state', label: 'Status' },
      { id: 'recording', label: 'Aufnahme (1/0)' },
    ],
    feedbacks: [{ id: 'recording', label: 'Aufnahme läuft', stateKey: 'recording', match: 'truthy', bgcolor: RED, color: WHITE }],
  },
};

/** Liste aller bekannten Rollen (für mDNS-Filter / Dropdowns). */
export const KNOWN_ROLES = Object.keys(CAPABILITIES);
