import { contextBridge, ipcRenderer } from 'electron';
import type { JmsApi } from '@shared/types';

const api: JmsApi = {
  platform: process.platform,
  app: {
    version: () => ipcRenderer.invoke('app:version') as Promise<string>,
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jms', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jms = api;
}
