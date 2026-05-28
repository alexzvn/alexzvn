import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ConvertProgress,
  ConvertResult,
  JmcApi,
  JobKind,
  OfficeConvertSpec,
  VideoConvertSpec,
} from '@shared/types';

const api: JmcApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  dialog: {
    pickFiles: (kind: JobKind) => ipcRenderer.invoke('dialog:pickFiles', kind) as Promise<string[]>,
    pickDir: () => ipcRenderer.invoke('dialog:pickDir') as Promise<string | null>,
  },
  media: {
    probe: (filePath) => ipcRenderer.invoke('media:probe', filePath),
  },
  encoders: {
    get: () => ipcRenderer.invoke('encoders:get'),
  },
  video: {
    enqueue: (spec: VideoConvertSpec) => ipcRenderer.invoke('video:enqueue', spec) as Promise<void>,
    cancel: (jobId) => ipcRenderer.invoke('video:cancel', jobId) as Promise<void>,
  },
  office: {
    detect: () => ipcRenderer.invoke('office:detect'),
    enqueue: (spec: OfficeConvertSpec) => ipcRenderer.invoke('office:enqueue', spec) as Promise<void>,
  },
  shell: {
    reveal: (filePath) => ipcRenderer.invoke('shell:reveal', filePath) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
  onProgress: (cb) => {
    const listener = (_event: unknown, p: ConvertProgress) => cb(p);
    ipcRenderer.on('job:progress', listener);
    return () => ipcRenderer.off('job:progress', listener);
  },
  onDone: (cb) => {
    const listener = (_event: unknown, r: ConvertResult) => cb(r);
    ipcRenderer.on('job:done', listener);
    return () => ipcRenderer.off('job:done', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmc', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmc = api;
}
