import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  JmtranscribeApi,
  PartialTranscribeConfig,
  TranscribeState,
  WhisperModelId,
} from '@shared/types';

const api: JmtranscribeApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('transcribe:getState') as Promise<TranscribeState>,
  setConfig: (patch: PartialTranscribeConfig) =>
    ipcRenderer.invoke('transcribe:setConfig', patch) as Promise<TranscribeState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: TranscribeState): void => cb(s);
    ipcRenderer.on('transcribe:state', listener);
    return () => ipcRenderer.off('transcribe:state', listener);
  },
  addFiles: () => ipcRenderer.invoke('transcribe:addFiles') as Promise<number>,
  addPaths: (paths: string[]) => ipcRenderer.invoke('transcribe:addPaths', paths) as Promise<number>,
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  removeJob: (id: string) => ipcRenderer.invoke('transcribe:removeJob', id) as Promise<void>,
  clearFinished: () => ipcRenderer.invoke('transcribe:clearFinished') as Promise<void>,
  start: () => ipcRenderer.invoke('transcribe:start') as Promise<void>,
  cancel: (id: string) => ipcRenderer.invoke('transcribe:cancel', id) as Promise<void>,
  chooseOutputDir: () => ipcRenderer.invoke('transcribe:chooseOutputDir') as Promise<string | null>,
  revealOutput: (p: string) => ipcRenderer.invoke('transcribe:revealOutput', p) as Promise<void>,
  downloadModel: (id: WhisperModelId) =>
    ipcRenderer.invoke('transcribe:downloadModel', id) as Promise<void>,
  deleteModel: (id: WhisperModelId) =>
    ipcRenderer.invoke('transcribe:deleteModel', id) as Promise<void>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmtranscribe', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmtranscribe = api;
}
