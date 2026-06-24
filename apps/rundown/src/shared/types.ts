// Datenmodell + IPC-Typen für JM Rundown (Welle 3a, Slice 1).
//
// Der „autoritative" Zustand (Dokument + scharfe Zeile) lebt im Main-Prozess —
// so kann auch der spätere RUNDOWN-Steuerserver (Companion, Slice 3) navigieren.
// Der Renderer ist Ansicht + Editor und schickt Änderungen per IPC zurück.

/** Eine Aktion, die beim GO an ein Tool gesendet wird. */
export interface RundownAction {
  id: string;
  /** Ziel-Rolle (CAPABILITIES), z. B. 'timer', 'presenter', 'switcher'. */
  role: string;
  /** Protokoll-Verb, z. B. 'start', 'goto', 'take'. */
  verb: string;
  /** Positions-Argumente (Token nach dem Verb). */
  args: (string | number)[];
  /** Deaktivierte Aktionen werden beim GO übersprungen. */
  enabled: boolean;
}

/** Eine Zeile/Segment im Ablaufplan. */
export interface RundownRow {
  id: string;
  label: string;
  note?: string;
  actions: RundownAction[];
}

/** Das Rundown-Dokument (Speicherformat `.jmrundown`). */
export interface RundownDoc {
  schemaVersion: 1;
  name: string;
  rows: RundownRow[];
}

/** Navigationsbefehl (vom UI oder später vom RUNDOWN-Steuerserver). */
export type RundownNav =
  | { t: 'go' }
  | { t: 'next' }
  | { t: 'prev' }
  | { t: 'goto'; n: number };

/** Verbindungsstatus eines vom Conductor entdeckten Tools. */
export interface ToolLink {
  role: string;
  label: string;
  host: string;
  port: number;
  connected: boolean;
}

/** Was beim letzten GO tatsächlich an die Tools ging (für die UI-Quittung). */
export interface FireReport {
  rowId: string;
  rowLabel: string;
  /** Pro Aktion: Protokollzeile + ob ein verbundenes Tool sie bekam. */
  sent: { role: string; line: string; delivered: boolean }[];
}

/** Vollständiger Zustand, den der Renderer (und das Ausgabe-/Companion-Bild) sieht. */
export interface RundownState {
  doc: RundownDoc;
  /** Index der scharfen Zeile. */
  index: number;
  filePath: string | null;
  dirty: boolean;
  /** Vom Conductor entdeckte/verbundene Tools. */
  links: ToolLink[];
  lastFired: FireReport | null;
}

// ── Preload-API (window.jmrundown) ───────────────────────────────────────────
export interface JmRundownApi {
  platform: string;
  getState: () => Promise<RundownState>;
  onState: (cb: (s: RundownState) => void) => () => void;
  /** Navigation/Conductor (GO feuert die scharfe Zeile). */
  nav: (cmd: RundownNav) => Promise<RundownState>;
  /** Dokument ersetzen (Editor speichert den ganzen Doc zurück). */
  setDoc: (doc: RundownDoc) => Promise<RundownState>;
  /** Datei-Operationen. */
  newDoc: () => Promise<RundownState>;
  open: () => Promise<RundownState>;
  save: () => Promise<RundownState>;
  saveAs: () => Promise<RundownState>;
}
