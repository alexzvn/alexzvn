import { ipcMain, type BrowserWindow } from 'electron';
import { hostname } from 'node:os';
import type { JmNdiSource, JmNdiStartOptions, JmNdiStatus } from '@shared/types';
import { IPC } from '@shared/ipc';
import { listSources } from './sources';
import { armCapture, disarmCapture } from './capture-handler';

let status: JmNdiStatus = { sendState: 'idle', audioEnabled: false };

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const pushStatus = (): void => {
    getWindow()?.webContents.send(IPC.status, status);
  };

  ipcMain.handle(IPC.listSources, (): Promise<JmNdiSource[]> => listSources());

  ipcMain.handle(IPC.start, async (_event, opts: JmNdiStartOptions): Promise<void> => {
    // Quelle für getDisplayMedia() im Renderer vormerken. Der native NDI-Sender
    // (utilityProcess) wird in Phase 1/4 hier zusätzlich gestartet.
    armCapture(opts);
    const name = (await listSources()).find((s) => s.id === opts.sourceId)?.name ?? 'Aufnahme';
    status = {
      sendState: 'sending',
      audioEnabled: opts.audio,
      ndiSourceName: `JM Capture (${hostname()}) - ${name}`,
    };
    pushStatus();
  });

  ipcMain.handle(IPC.stop, async (): Promise<void> => {
    disarmCapture();
    status = { sendState: 'idle', audioEnabled: status.audioEnabled };
    pushStatus();
  });

  ipcMain.handle(IPC.getStatus, (): Promise<JmNdiStatus> => Promise.resolve(status));
}
