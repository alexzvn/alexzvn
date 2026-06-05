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

/**
 * Installationsstatus: bevorzugt die vom Launcher gemerkte Version (echter
 * Versionsvergleich), sonst Dateisystem-Probe (installiert, Version unbekannt).
 */
export function getToolState(tool: ToolManifest): ToolState {
  const records = readRecords();
  const recorded = records[tool.id] ?? null;
  if (recorded) {
    return {
      id: tool.id,
      status: recorded === tool.latestVersion ? 'installed' : 'update-available',
      installedVersion: recorded,
    };
  }
  const path = installPathFor(tool);
  const exists = path ? existsSync(path) : false;
  return {
    id: tool.id,
    status: exists ? 'installed' : 'not-installed',
    installedVersion: null,
  };
}

export function getAllStates(tools: ToolManifest[]): ToolState[] {
  return tools.map(getToolState);
}
