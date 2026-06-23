import { ipcMain } from 'electron';
import { listScreens } from './sources';
import { armCapture } from './capture-handler';
import { ndiConnect, ndiDisconnect, ndiFind, ndiStatus } from './ndi-receive';
import { ndiOutputStatus, startNdiOutput, stopNdiOutput } from './ndi-send';
import { registerOutputIpc } from './output';
import { controlStatus, pushState, startControlServer, stopControlServer } from './control-server';
import type { SwitcherStateMsg } from '@jm/companion-protocol';

export function registerIpc(): void {
  ipcMain.handle('sources:listScreens', () => listScreens());
  ipcMain.handle('capture:arm', (_e, sourceId: string) => armCapture(sourceId));

  ipcMain.handle('ndi:find', (_e, timeoutMs?: number) => ndiFind(timeoutMs));
  ipcMain.handle('ndi:connect', (_e, recvId: string, source: string) => ndiConnect(recvId, source));
  ipcMain.handle('ndi:disconnect', (_e, recvId: string) => ndiDisconnect(recvId));
  ipcMain.handle('ndi:status', () => ndiStatus());

  registerOutputIpc();

  ipcMain.handle('output:ndiStart', (_e, name: string) => startNdiOutput(name));
  ipcMain.handle('output:ndiStop', () => {
    stopNdiOutput();
  });
  ipcMain.handle('output:ndiStatus', () => ndiOutputStatus());

  ipcMain.handle('control:start', (_e, port: number) => startControlServer(port));
  ipcMain.handle('control:stop', () => {
    stopControlServer();
  });
  ipcMain.handle('control:status', () => controlStatus());
  ipcMain.on('control:pushState', (_e, state: SwitcherStateMsg) => pushState(state));
}
