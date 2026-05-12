import { contextBridge } from 'electron';

const api = {
  platform: process.platform,
  versions: process.versions,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jm', api);
} else {
  // @ts-expect-error fallback if context isolation is disabled
  window.jm = api;
}

export type JmApi = typeof api;
