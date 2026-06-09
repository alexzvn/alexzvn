import { contextBridge, ipcRenderer } from 'electron';
import type { JmswitchApi, NdiStatus, ScreenSourceInfo } from '@shared/types';

// Den vom Main übertragenen NDI-Frame-MessagePort in den Renderer-Main-World
// durchreichen — contextBridge kann MessagePorts nicht direkt übergeben, daher
// der dokumentierte window.postMessage-Transfer (Empfang: window 'message').
ipcRenderer.on('jmswitch:ndi-port', (e) => {
  window.postMessage('jmswitch:ndi-port', '*', e.ports);
});

const api: JmswitchApi = {
  platform: process.platform,
  listScreens: () => ipcRenderer.invoke('sources:listScreens') as Promise<ScreenSourceInfo[]>,
  armCapture: (sourceId) => ipcRenderer.invoke('capture:arm', sourceId) as Promise<void>,
  ndi: {
    find: (timeoutMs) => ipcRenderer.invoke('ndi:find', timeoutMs) as Promise<string[]>,
    connect: (source) => ipcRenderer.invoke('ndi:connect', source) as Promise<void>,
    disconnect: () => ipcRenderer.invoke('ndi:disconnect') as Promise<void>,
    getStatus: () => ipcRenderer.invoke('ndi:status') as Promise<NdiStatus>,
    onStatus: (cb) => {
      const listener = (_event: unknown, s: NdiStatus) => cb(s);
      ipcRenderer.on('ndi:status', listener);
      return () => ipcRenderer.off('ndi:status', listener);
    },
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmswitch', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmswitch = api;
}
