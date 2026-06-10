import { contextBridge, ipcRenderer } from 'electron';
import type { DisplayInfo, JmstageApi, PartialStageConfig, StageState } from '@shared/types';

const api: JmstageApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('stage:getState') as Promise<StageState>,
  setConfig: (patch: PartialStageConfig) =>
    ipcRenderer.invoke('stage:setConfig', patch) as Promise<StageState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: StageState): void => cb(s);
    ipcRenderer.on('stage:state', listener);
    return () => ipcRenderer.off('stage:state', listener);
  },
  output: {
    displays: () => ipcRenderer.invoke('output:displays') as Promise<DisplayInfo[]>,
    open: (displayId) => ipcRenderer.invoke('output:open', displayId) as Promise<void>,
    close: () => ipcRenderer.invoke('output:close') as Promise<void>,
    isOpen: () => ipcRenderer.invoke('output:isOpen') as Promise<boolean>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmstage', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmstage = api;
}
