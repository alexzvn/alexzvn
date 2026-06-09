import { contextBridge, ipcRenderer } from 'electron';
import type {
  JmswitchApi,
  NdiStatus,
  OutputError,
  OutputStatus,
  ScreenSourceInfo,
} from '@shared/types';

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
  output: {
    recStart: () =>
      ipcRenderer.invoke('output:recStart') as Promise<{ ok: boolean; path?: string; error?: string }>,
    recChunk: (chunk) => ipcRenderer.send('output:recChunk', chunk),
    recStop: () => ipcRenderer.send('output:recStop'),
    streamStart: (url, videoBitrateKbps) =>
      ipcRenderer.invoke('output:streamStart', { url, videoBitrateKbps }) as Promise<{
        ok: boolean;
        error?: string;
      }>,
    streamChunk: (chunk) => ipcRenderer.send('output:streamChunk', chunk),
    streamStop: () => ipcRenderer.send('output:streamStop'),
    onStatus: (cb) => {
      const listener = (_event: unknown, s: OutputStatus) => cb(s);
      ipcRenderer.on('output:status', listener);
      return () => ipcRenderer.off('output:status', listener);
    },
    onError: (cb) => {
      const listener = (_event: unknown, e: OutputError) => cb(e);
      ipcRenderer.on('output:error', listener);
      return () => ipcRenderer.off('output:error', listener);
    },
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmswitch', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmswitch = api;
}
