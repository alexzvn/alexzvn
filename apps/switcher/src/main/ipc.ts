import { ipcMain } from 'electron';
import { listScreens } from './sources';
import { armCapture } from './capture-handler';
import { ndiConnect, ndiDisconnect, ndiFind, ndiStatus } from './ndi-receive';
import { registerOutputIpc } from './output';

export function registerIpc(): void {
  ipcMain.handle('sources:listScreens', () => listScreens());
  ipcMain.handle('capture:arm', (_e, sourceId: string) => armCapture(sourceId));

  ipcMain.handle('ndi:find', (_e, timeoutMs?: number) => ndiFind(timeoutMs));
  ipcMain.handle('ndi:connect', (_e, source: string) => ndiConnect(source));
  ipcMain.handle('ndi:disconnect', () => ndiDisconnect());
  ipcMain.handle('ndi:status', () => ndiStatus());

  registerOutputIpc();
}
