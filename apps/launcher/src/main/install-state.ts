import { existsSync } from 'node:fs';
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

/**
 * Ermittelt den Installationsstatus per Dateisystem-Probe.
 * Phase 2 ergänzt hier den Versionsvergleich (installedVersion vs. latestVersion).
 */
export function getToolState(tool: ToolManifest): ToolState {
  const path = installPathFor(tool);
  const installed = path ? existsSync(path) : false;
  return {
    id: tool.id,
    status: installed ? 'installed' : 'not-installed',
    installedVersion: null,
  };
}

export function getAllStates(tools: ToolManifest[]): ToolState[] {
  return tools.map(getToolState);
}
