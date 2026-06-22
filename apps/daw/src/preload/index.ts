import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ArmInput,
  ExportProgress,
  ExportResult,
  ExportRunRequest,
  JmdawApi,
  Levels,
  PickOutputRequest,
  RecorderState,
  SaveProjectRequest,
  StartRecordInput,
} from '@shared/ipc-types';
import type { MediaAsset } from '@shared/project';

const api: JmdawApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  dialog: {
    importAudio: () => ipcRenderer.invoke('dialog:importAudio') as Promise<string[]>,
  },
  media: {
    import: (paths) => ipcRenderer.invoke('media:import', paths),
    transcodeForDecode: (asset: MediaAsset) => ipcRenderer.invoke('media:transcodeForDecode', asset),
  },
  project: {
    open: () => ipcRenderer.invoke('project:open'),
    save: (req: SaveProjectRequest) => ipcRenderer.invoke('project:save', req),
  },
  export: {
    pickOutput: (req: PickOutputRequest) => ipcRenderer.invoke('export:pickOutput', req) as Promise<string | null>,
    start: (req: ExportRunRequest) => ipcRenderer.invoke('export:start', req),
    cancel: (id) => ipcRenderer.invoke('export:cancel', id) as Promise<void>,
  },
  rec: {
    listDevices: () => ipcRenderer.invoke('rec:listDevices'),
    arm: (input: ArmInput) => ipcRenderer.invoke('rec:arm', input),
    disarm: () => ipcRenderer.invoke('rec:disarm') as Promise<void>,
    start: (input: StartRecordInput) => ipcRenderer.invoke('rec:start', input),
    stop: () => ipcRenderer.invoke('rec:stop'),
    getState: () => ipcRenderer.invoke('rec:state'),
  },
  shell: {
    reveal: (p) => ipcRenderer.invoke('shell:reveal', p) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
  onExportProgress: (cb) => {
    const listener = (_e: unknown, p: ExportProgress): void => cb(p);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.off('export:progress', listener);
  },
  onExportDone: (cb) => {
    const listener = (_e: unknown, r: ExportResult): void => cb(r);
    ipcRenderer.on('export:done', listener);
    return () => ipcRenderer.off('export:done', listener);
  },
  onRecLevels: (cb) => {
    const listener = (_e: unknown, l: Levels): void => cb(l);
    ipcRenderer.on('rec:levels', listener);
    return () => ipcRenderer.off('rec:levels', listener);
  },
  onRecState: (cb) => {
    const listener = (_e: unknown, s: RecorderState): void => cb(s);
    ipcRenderer.on('rec:state', listener);
    return () => ipcRenderer.off('rec:state', listener);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmdaw', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmdaw = api;
}
