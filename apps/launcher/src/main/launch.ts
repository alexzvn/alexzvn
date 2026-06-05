import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { shell } from 'electron';
import type { ToolManifest } from '@jm/suite-manifest';
import type { ActionResult } from '@shared/types';
import { installPathFor } from './install-state';

/** Startet ein installiertes Tool als eigenständigen Prozess. */
export async function openTool(tool: ToolManifest): Promise<ActionResult> {
  const target = installPathFor(tool);
  if (!target || !existsSync(target)) {
    return { ok: false, message: `${tool.name} ist nicht installiert.` };
  }
  try {
    if (process.platform === 'darwin') {
      spawn('open', ['-a', target], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'win32') {
      spawn(target, [], { detached: true, stdio: 'ignore' }).unref();
    } else {
      const err = await shell.openPath(target);
      if (err) return { ok: false, message: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Release-Seite des Tools (Phase 1: manueller Download, Phase 2: Auto-Install). */
export function releasesUrl(tool: ToolManifest): string {
  return `https://github.com/${tool.repo}/releases/latest`;
}
