import { contextBridge, ipcRenderer } from 'electron';
import type { JmswitchApi, ScreenSourceInfo } from '@shared/types';

const api: JmswitchApi = {
  platform: process.platform,
  listScreens: () => ipcRenderer.invoke('sources:listScreens') as Promise<ScreenSourceInfo[]>,
  armCapture: (sourceId) => ipcRenderer.invoke('capture:arm', sourceId) as Promise<void>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmswitch', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmswitch = api;
}
