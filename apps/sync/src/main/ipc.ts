import { app, ipcMain, shell } from 'electron';

/**
 * Registers the minimal main-process IPC surface for the Phase 0 shell.
 * Measurement runs entirely in the renderer (Web Audio + video frames),
 * so the bridge stays small — extended in later phases as needed.
 */
export function registerIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url));
}
