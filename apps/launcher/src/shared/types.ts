import type { ToolManifest, ToolState } from '@jm/suite-manifest';

export type { ToolManifest, ToolState, ToolCategory, InstallStatus } from '@jm/suite-manifest';

/** Ergebnis einer Launcher-Aktion (öffnen/installieren/aktualisieren). */
export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Fortschritts-/Statusmeldung während Download & Installation. */
export interface InstallProgress {
  id: string;
  phase: 'download' | 'install' | 'done' | 'error';
  received?: number;
  total?: number;
  /** 0–100, falls die Gesamtgröße bekannt ist. */
  pct?: number;
  message?: string;
}

/** Eingabe zum Speichern der Einstellungen (Token wird nie zurückgegeben). */
export interface SuiteSettingsInput {
  githubToken?: string;
  proxyUrl?: string;
}

/** Für die UI sichtbarer Einstellungs-Zustand (ohne Klartext-Token). */
export interface SuiteSettingsView {
  hasToken: boolean;
  proxyUrl?: string;
  /** Welche Release-Quelle aktuell aktiv ist. */
  source: 'github' | 'proxy' | 'none';
  /** Quelle stammt aus Umgebungsvariable (read-only in der UI). */
  fromEnv: boolean;
}

/** Die unter `window.jmps` bereitgestellte Launcher-API. */
export interface JmpsApi {
  platform: NodeJS.Platform;
  listTools: () => Promise<ToolManifest[]>;
  getState: () => Promise<ToolState[]>;
  open: (id: string) => Promise<ActionResult>;
  install: (id: string) => Promise<ActionResult>;
  update: (id: string) => Promise<ActionResult>;
  openExternal: (url: string) => Promise<void>;
  getSettings: () => Promise<SuiteSettingsView>;
  setSettings: (settings: SuiteSettingsInput) => Promise<SuiteSettingsView>;
  onProgress: (cb: (p: InstallProgress) => void) => () => void;
}
