import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  CopySpec,
  FileProgress,
  JmcpApi,
  JobProgress,
  JobResult,
  VerifyProgress,
} from '@shared/types';

const api: JmcpApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  dialog: {
    pickDir: (title) => ipcRenderer.invoke('dialog:pickDir', title) as Promise<string | null>,
    pickFiles: () => ipcRenderer.invoke('dialog:pickFiles') as Promise<string[]>,
  },
  scan: {
    paths: (paths) => ipcRenderer.invoke('scan:paths', paths),
  },
  copy: {
    start: (spec: CopySpec) => ipcRenderer.invoke('copy:start', spec) as Promise<void>,
    cancel: (jobId) => ipcRenderer.invoke('copy:cancel', jobId) as Promise<void>,
  },
  verify: {
    findMhl: (dir) => ipcRenderer.invoke('verify:findMhl', dir) as Promise<string[]>,
    run: (mhlPath) => ipcRenderer.invoke('verify:run', mhlPath),
  },
  shell: {
    reveal: (filePath) => ipcRenderer.invoke('shell:reveal', filePath) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
  onFileProgress: (cb) => {
    const listener = (_event: unknown, p: FileProgress) => cb(p);
    ipcRenderer.on('copy:fileProgress', listener);
    return () => ipcRenderer.off('copy:fileProgress', listener);
  },
  onJobProgress: (cb) => {
    const listener = (_event: unknown, p: JobProgress) => cb(p);
    ipcRenderer.on('copy:jobProgress', listener);
    return () => ipcRenderer.off('copy:jobProgress', listener);
  },
  onDone: (cb) => {
    const listener = (_event: unknown, r: JobResult) => cb(r);
    ipcRenderer.on('copy:done', listener);
    return () => ipcRenderer.off('copy:done', listener);
  },
  onVerifyProgress: (cb) => {
    const listener = (_event: unknown, p: VerifyProgress) => cb(p);
    ipcRenderer.on('verify:progress', listener);
    return () => ipcRenderer.off('verify:progress', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmcp', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmcp = api;
}
