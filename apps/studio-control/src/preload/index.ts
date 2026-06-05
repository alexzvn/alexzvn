import { contextBridge, ipcRenderer } from 'electron';

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 7778;

const api = {
  platform: process.platform,
  versions: process.versions,
  serverUrl: `http://${SERVER_HOST}:${SERVER_PORT}`,
  isElectron: true,
  remote: {
    getUrls: () => ipcRenderer.invoke('remote:getUrls') as Promise<string[]>,
    getAddresses: () => ipcRenderer.invoke('remote:getAddresses') as Promise<string[]>,
  },
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jms', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jms = api;
}

export type JmsApi = typeof api;
