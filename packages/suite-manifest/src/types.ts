/** Kategorien für die Gruppierung im Launcher-Dashboard. */
export type ToolCategory = 'Ingest' | 'Grafik' | 'Studio' | 'Utilities';

export type Platform = 'mac' | 'win';

export interface PlatformInfo {
  /**
   * electron-builder-Artefaktname mit Platzhaltern `${version}` / `${arch}`,
   * z. B. "JM Copy-${version}-win-x64.exe". Wird beim Download aufgelöst (Phase 2).
   */
  artifact: string;
  /** macOS: Pfad der installierten App, z. B. "/Applications/JM Copy.app". */
  appPath?: string;
  /** Windows: Pfad der EXE; `%LOCALAPPDATA%` wird zur Laufzeit ersetzt. */
  exePath?: string;
}

export interface ToolManifest {
  /** Stabile ID, entspricht dem Ordner-/Repo-Namen (z. B. "jm-copy"). */
  id: string;
  /** Anzeigename (z. B. "JM Copy"). */
  name: string;
  /** Kurze Funktionszeile fürs Dashboard. */
  tagline: string;
  /** Ausführlichere Beschreibung. */
  description: string;
  category: ToolCategory;
  /** electron-builder appId (z. B. "gmbh.jakobs.copy"). */
  appId: string;
  /** owner/repo der privaten GitHub-Release-Quelle (genutzt ab Phase 2). */
  repo: string;
  /**
   * Ordnername unter `apps/` und zugleich Präfix des Release-Tags
   * `<app>-v<version>` (z. B. "copy" → Tag "copy-v0.1.0"). Im Monorepo teilen
   * sich alle Tools `repo`, werden aber über dieses Tag-Präfix unterschieden.
   */
  app: string;
  /** Neueste verfügbare Version laut Registry. */
  latestVersion: string;
  platforms: Partial<Record<Platform, PlatformInfo>>;
}

export interface SuiteManifest {
  schemaVersion: number;
  /** ISO-Zeitstempel der letzten Registry-Aktualisierung. */
  updatedAt: string;
  tools: ToolManifest[];
}

/** Ein Versionseintrag in den Patch Notes einer App. */
export interface ChangelogEntry {
  version: string;
  /** ISO-Datum (optional, nur zur Anzeige). */
  date?: string;
  notes: string[];
}

/** Patch Notes einer App (Launcher oder Tool); Versionen neueste zuerst. */
export interface AppChangelog {
  /** 'launcher' oder die `app`-Kennung eines Tools (Release-Tag-Präfix). */
  app: string;
  name: string;
  entries: ChangelogEntry[];
}

/** Installationsstatus eines Tools, zur Laufzeit vom Launcher ermittelt. */
export type InstallStatus = 'installed' | 'update-available' | 'not-installed';

export interface ToolState {
  id: string;
  status: InstallStatus;
  /** Installierte Version, falls ermittelbar; sonst null. */
  installedVersion: string | null;
  /** Neueste online verfügbare Version, wenn ein Update bereitsteht (sonst
   *  weggelassen) — live aus den Releases ermittelt. */
  latestAvailable?: string;
}
