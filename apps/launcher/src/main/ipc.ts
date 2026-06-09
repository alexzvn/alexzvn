import { app, ipcMain, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type { ActionResult, FeedbackInput, InstallProgress, SuiteSettingsInput } from '@shared/types';
import type { ToolManifest } from '@jm/suite-manifest';
import { getTool, getTools } from './manifest';
import { getAllStates } from './install-state';
import { checkToolUpdates, checkLauncherUpdate } from './updates';
import { openTool } from './launch';
import { installTool, updateLauncher } from './installer';
import { getSettingsView, setSettings } from './settings';
import { submitFeedback } from './feedback';

function withTool(
  id: string,
  fn: (tool: ToolManifest) => Promise<ActionResult>,
): Promise<ActionResult> {
  const tool = getTool(id);
  if (!tool) return Promise.resolve({ ok: false, message: 'Unbekanntes Tool.' });
  return fn(tool);
}

export function registerIpc(): void {
  // Eigene Launcher-Version (für die Anzeige im Header, Issue #12).
  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('suite:list', () => getTools());
  ipcMain.handle('suite:state', () => getAllStates(getTools()));
  // Live-Update-Prüfung gegen die Releases (online, sonst unveränderte Zustände).
  ipcMain.handle('suite:check-updates', () => checkToolUpdates(getTools()));

  ipcMain.handle('tool:open', (_e, id: string) => withTool(id, openTool));

  // Download + Installation aus der konfigurierten Release-Quelle, mit
  // Fortschritt an das aufrufende Fenster. Update == Install der neuesten Version.
  const runInstall = (e: IpcMainInvokeEvent, id: string) =>
    withTool(id, (tool) =>
      installTool(tool, (p: InstallProgress) => e.sender.send('suite:progress', p)),
    );
  ipcMain.handle('tool:install', runInstall);
  ipcMain.handle('tool:update', runInstall);

  // Launcher-Self-Update: Info abfragen + Download/Install (beendet die App).
  ipcMain.handle('launcher:update-info', () => checkLauncherUpdate(getTools()));
  ipcMain.handle('launcher:update', (e: IpcMainInvokeEvent) =>
    updateLauncher((p: InstallProgress) => e.sender.send('suite:progress', p)),
  );

  ipcMain.handle('settings:get', () => getSettingsView());
  ipcMain.handle('settings:set', (_e, input: SuiteSettingsInput) => setSettings(input));

  // Bug-/Wunsch-Meldung → GitHub-Issue (via Proxy, sonst Token-Fallback).
  ipcMain.handle('feedback:submit', (_e, input: FeedbackInput) => submitFeedback(input));

  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}
