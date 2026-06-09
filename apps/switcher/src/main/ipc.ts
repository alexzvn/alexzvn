import { ipcMain } from 'electron';
import { listScreens } from './sources';
import { armCapture } from './capture-handler';

export function registerIpc(): void {
  ipcMain.handle('sources:listScreens', () => listScreens());
  ipcMain.handle('capture:arm', (_e, sourceId: string) => armCapture(sourceId));
}
