import { contextBridge, ipcRenderer } from 'electron';
import type { CaptionConfig, CaptionState, JmCaptionApi } from '@shared/types';

const api: JmCaptionApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('caption:getState') as Promise<CaptionState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: CaptionState): void => cb(s);
    ipcRenderer.on('caption:state', listener);
    return () => ipcRenderer.off('caption:state', listener);
  },
  setConfig: (patch: Partial<CaptionConfig>) =>
    ipcRenderer.invoke('caption:setConfig', patch) as Promise<CaptionState>,
  start: () => ipcRenderer.invoke('caption:start') as Promise<CaptionState>,
  stop: () => ipcRenderer.invoke('caption:stop') as Promise<CaptionState>,
  setHold: (h: boolean) => ipcRenderer.invoke('caption:setHold', h) as Promise<CaptionState>,
  clear: () => ipcRenderer.invoke('caption:clear') as Promise<CaptionState>,
  correctLast: (text: string) => ipcRenderer.invoke('caption:correctLast', text) as Promise<CaptionState>,
  pushUtterance: (pcm: Float32Array, sampleRate: number) =>
    ipcRenderer.send('caption:utterance', pcm, sampleRate),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmcaption', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmcaption = api;
}
