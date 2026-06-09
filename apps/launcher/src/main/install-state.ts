import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Platform, ToolManifest, ToolState } from '@jm/suite-manifest';

function currentPlatform(): Platform | null {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  return null;
}

/** Ersetzt `%NAME%`-Umgebungsvariablen (Windows-Pfade). */
function expandEnv(input: string): string {
  return input.replace(/%([^%]+)%/g, (_, name: string) => process.env[name] ?? '');
}

/** Erwarteter Installationspfad des Tools auf der aktuellen Plattform (oder null). */
export function installPathFor(tool: ToolManifest): string | null {
  const platform = currentPlatform();
  if (!platform) return null;
  const info = tool.platforms[platform];
  if (!info) return null;
  if (platform === 'mac') return info.appPath ?? null;
  return info.exePath ? expandEnv(info.exePath) : null;
}

// --- Versionsregister der vom Launcher installierten Tools ----------------------

function recordsFile(): string {
  return join(app.getPath('userData'), 'installed.json');
}

function readRecords(): Record<string, string> {
  try {
    if (existsSync(recordsFile())) {
      return JSON.parse(readFileSync(recordsFile(), 'utf8')) as Record<string, string>;
    }
  } catch {
    // korrupte Datei ignorieren
  }
  return {};
}

/** Hält fest, welche Version der Launcher zuletzt für ein Tool installiert hat. */
export function recordInstalled(id: string, version: string): void {
  const records = readRecords();
  records[id] = version;
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(recordsFile(), JSON.stringify(records, null, 2));
}

/** Entfernt den Versions-Record eines Tools (nach Deinstallation, Issue #7). */
export function forgetInstalled(id: string): void {
  const records = readRecords();
  if (records[id] === undefined) return;
  delete records[id];
  try {
    writeFileSync(recordsFile(), JSON.stringify(records, null, 2));
  } catch {
    // nicht schreibbar → ignorieren (Status folgt ohnehin der Datei-Existenz)
  }
}

/**
 * Installationsstatus: maßgeblich ist immer, ob die App-Datei wirklich auf der
 * Platte liegt (sonst meldete der Launcher „installiert", sobald der Installer
 * nur GESTARTET wurde — auch wenn SmartScreen ihn blockt oder der User abbricht).
 * Liegt die Datei UND kennen wir die installierte Version, vergleichen wir sie
 * fürs Update; liegt sie ohne bekannte Version, gilt „installiert" (Version
 * unbekannt).
 */
export function getToolState(tool: ToolManifest): ToolState {
  const path = installPathFor(tool);
  const exists = path ? existsSync(path) : false;
  if (!exists) {
    return { id: tool.id, status: 'not-installed', installedVersion: null };
  }
  // installiert; „update-available" wird NICHT mehr statisch aus dem Manifest
  // bestimmt, sondern live aus den GitHub-Releases (siehe updates.ts) — das
  // statische `latestVersion` veraltete, sobald jemand eine neuere Version als
  // das gebündelte Manifest installierte.
  const recorded = readRecords()[tool.id] ?? null;
  return { id: tool.id, status: 'installed', installedVersion: recorded };
}

export function getAllStates(tools: ToolManifest[]): ToolState[] {
  return tools.map(getToolState);
}
