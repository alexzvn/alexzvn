// Datenmodell + IPC-Typen für JM Q&A (Welle 3c).
//
// Q&A verwaltet eine Wortmeldungs-/Frage-Queue (Pressekonferenz, Townhall). Der
// autoritative Zustand lebt im Main (damit auch der QA-Steuerserver/Companion und
// die Saal-Einreichung per Handy darauf wirken). Wird ein Sprecher scharf
// geschaltet, koppelt Q&A automatisch an den **Timer** (Redezeit) und den
// **Titler** (Name/Funktion als Bauchbinde) über das suite-weite Steuerprotokoll.

export type QaStatus = 'waiting' | 'active' | 'done';
export type QaSource = 'operator' | 'remote';

/** Eine Wortmeldung/Frage in der Queue. */
export interface QaEntry {
  id: string;
  /** Name des Sprechers/Fragestellers (Bauchbinde-Hauptzeile). */
  name: string;
  /** Funktion/Medium/Fraktion (Bauchbinde-Unterzeile). */
  affiliation: string;
  /** Optionaler Fragetext. */
  question: string;
  status: QaStatus;
  source: QaSource;
  /** Remote-Einreichungen müssen bei Moderation erst freigegeben werden. */
  approved: boolean;
  at: number;
}

export interface QaConfig {
  /** Redezeit-Limit in Sekunden (Timer-Kopplung). */
  speakSeconds: number;
  /** Bei Aktivierung den Timer auf speakSeconds setzen + starten. */
  autoTimer: boolean;
  /** Bei Aktivierung die Bauchbinde (Titler) mit Name/Funktion einblenden. */
  autoTitler: boolean;
  /** Remote-Einreichungen erst nach Freigabe in die Queue. */
  moderation: boolean;
  /** Saal-Einreichung per Handy (QR) aktiv. */
  remoteEnabled: boolean;
  /** Titler-Vorlage, die bei der Einblendung gewählt wird. */
  titlerTemplate: 'lowerthird' | 'banner' | 'ticker';
}

export interface QaRemoteInfo {
  running: boolean;
  /** Erreichbare LAN-URLs der Saal-Einreichung. */
  urls: string[];
}

/** Host/Port eines Tool-Steuer-Endpunkts. */
export interface Endpoint {
  host: string;
  port: number;
}

/** Verbindungsstatus eines vom Coupling entdeckten/konfigurierten Tools. */
export interface ToolLink {
  role: string;
  label: string;
  host: string;
  port: number;
  connected: boolean;
  source: 'mdns' | 'manual';
  /** Letzter STATE-Push (Tally) — Schlüssel=Wert als Strings. */
  state: Record<string, string> | null;
}

/** Vollständiger Zustand, den der Renderer sieht. */
export interface QaState {
  entries: QaEntry[];
  /** Id des aktiven Sprechers (abgeleitet: Eintrag mit status 'active'). */
  activeId: string | null;
  config: QaConfig;
  remote: QaRemoteInfo;
  /** Gekoppelte Tools (titler/timer) inkl. Verbindung/Tally. */
  links: ToolLink[];
  /** Manuelle Endpunkt-Overrides je Rolle. */
  overrides: Record<string, Endpoint>;
}

/** Eingabe für eine neue Wortmeldung (Operator oder Handy). */
export interface QaSubmission {
  name: string;
  affiliation?: string;
  question?: string;
}

// ── Preload-API (window.jmqa) ────────────────────────────────────────────────
export interface JmQaApi {
  platform: string;
  getState: () => Promise<QaState>;
  onState: (cb: (s: QaState) => void) => () => void;
  /** Nur die Tool-Verbindungen/Tally (häufige Updates). */
  onLinks: (cb: (links: ToolLink[]) => void) => () => void;

  // Queue-Operationen
  addEntry: (sub: QaSubmission) => Promise<QaState>;
  updateEntry: (id: string, patch: QaSubmission) => Promise<QaState>;
  removeEntry: (id: string) => Promise<QaState>;
  moveEntry: (id: string, dir: -1 | 1) => Promise<QaState>;
  approveEntry: (id: string, approved: boolean) => Promise<QaState>;

  // Ablauf
  activate: (id: string) => Promise<QaState>;
  next: () => Promise<QaState>;
  endActive: () => Promise<QaState>;
  clearDone: () => Promise<QaState>;
  clearAll: () => Promise<QaState>;

  // Konfiguration + Saal-Einreichung + Endpunkte
  setConfig: (patch: Partial<QaConfig>) => Promise<QaState>;
  setRemote: (enabled: boolean) => Promise<QaState>;
  setEndpoint: (role: string, host: string, port: number) => Promise<QaState>;
}
