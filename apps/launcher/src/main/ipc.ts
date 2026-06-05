import { ipcMain, shell } from 'electron';
import type { ActionResult } from '@shared/types';
import { getTool, getTools } from './manifest';
import { getAllStates } from './install-state';
import { openTool, releasesUrl } from './launch';

export function registerIpc(): void {
  ipcMain.handle('suite:list', () => getTools());
  ipcMain.handle('suite:state', () => getAllStates(getTools()));

  ipcMain.handle('tool:open', async (_e, id: string): Promise<ActionResult> => {
    const tool = getTool(id);
    if (!tool) return { ok: false, message: 'Unbekanntes Tool.' };
    return openTool(tool);
  });

  // Phase 1: öffnet die Release-Seite. Phase 2 ersetzt dies durch echten
  // Download + Installation aus dem privaten GitHub-Release.
  ipcMain.handle('tool:install', async (_e, id: string): Promise<ActionResult> => {
    const tool = getTool(id);
    if (!tool) return { ok: false, message: 'Unbekanntes Tool.' };
    await shell.openExternal(releasesUrl(tool));
    return { ok: true, message: 'Download-Seite geöffnet. Automatische Installation folgt in Phase 2.' };
  });

  ipcMain.handle('tool:update', async (_e, id: string): Promise<ActionResult> => {
    const tool = getTool(id);
    if (!tool) return { ok: false, message: 'Unbekanntes Tool.' };
    await shell.openExternal(releasesUrl(tool));
    return { ok: true, message: 'Release-Seite geöffnet. Automatische Updates folgen in Phase 2.' };
  });

  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}
