import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { JmgApi, PickedImage, SaveImageRequest } from '@shared/types';

const api: JmgApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  dialog: {
    pickImages: () => ipcRenderer.invoke('dialog:pickImages') as Promise<PickedImage[]>,
  },
  file: {
    read: (path) => ipcRenderer.invoke('file:read', path) as Promise<PickedImage>,
    saveImage: (req: SaveImageRequest) => ipcRenderer.invoke('file:saveImage', req),
  },
  shell: {
    reveal: (path) => ipcRenderer.invoke('shell:reveal', path) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmg', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmg = api;
}
