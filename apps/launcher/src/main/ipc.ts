import { ipcMain, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type { ActionResult, InstallProgress, SuiteSettingsInput } from '@shared/types';
import type { ToolManifest } from '@jm/suite-manifest';
import { getTool, getTools } from './manifest';
import { getAllStates } from './install-state';
import { openTool } from './launch';
import { installTool } from './installer';
import { getSettingsView, setSettings } from './settings';

function withTool(
  id: string,
  fn: (tool: ToolManifest) => Promise<ActionResult>,
): Promise<ActionResult> {
  const tool = getTool(id);
  if (!tool) return Promise.resolve({ ok: false, message: 'Unbekanntes Tool.' });
  return fn(tool);
}

export function registerIpc(): void {
  ipcMain.handle('suite:list', () => getTools());
  ipcMain.handle('suite:state', () => getAllStates(getTools()));

  ipcMain.handle('tool:open', (_e, id: string) => withTool(id, openTool));

  // Download + Installation aus der konfigurierten Release-Quelle, mit
  // Fortschritt an das aufrufende Fenster. Update == Install der neuesten Version.
  const runInstall = (e: IpcMainInvokeEvent, id: string) =>
    withTool(id, (tool) =>
      installTool(tool, (p: InstallProgress) => e.sender.send('suite:progress', p)),
    );
  ipcMain.handle('tool:install', runInstall);
  ipcMain.handle('tool:update', runInstall);

  ipcMain.handle('settings:get', () => getSettingsView());
  ipcMain.handle('settings:set', (_e, input: SuiteSettingsInput) => setSettings(input));

  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}
