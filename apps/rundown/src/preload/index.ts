import { contextBridge, ipcRenderer } from 'electron';
import type { JmRundownApi, RundownDoc, RundownNav, RundownState } from '@shared/types';

const api: JmRundownApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('rundown:getState') as Promise<RundownState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: RundownState): void => cb(s);
    ipcRenderer.on('rundown:state', listener);
    return () => ipcRenderer.off('rundown:state', listener);
  },
  nav: (cmd: RundownNav) => ipcRenderer.invoke('rundown:nav', cmd) as Promise<RundownState>,
  setDoc: (doc: RundownDoc) => ipcRenderer.invoke('rundown:setDoc', doc) as Promise<RundownState>,
  newDoc: () => ipcRenderer.invoke('rundown:new') as Promise<RundownState>,
  open: () => ipcRenderer.invoke('rundown:open') as Promise<RundownState>,
  save: () => ipcRenderer.invoke('rundown:save') as Promise<RundownState>,
  saveAs: () => ipcRenderer.invoke('rundown:saveAs') as Promise<RundownState>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmrundown', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmrundown = api;
}
