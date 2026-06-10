import { create } from 'zustand';
import type { PartialTranscribeConfig, TranscribeState, WhisperModelId } from '@shared/types';

interface TranscribeStore {
  state: TranscribeState | null;
  load: () => Promise<void>;
  setConfig: (patch: PartialTranscribeConfig) => Promise<void>;
  addFiles: () => Promise<void>;
  addPaths: (paths: string[]) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  start: () => Promise<void>;
  cancel: (id: string) => Promise<void>;
  chooseOutputDir: () => Promise<void>;
  downloadModel: (id: WhisperModelId) => Promise<void>;
  deleteModel: (id: WhisperModelId) => Promise<void>;
}

let subscribed = false;

export const useTranscribe = create<TranscribeStore>((set) => ({
  state: null,
  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmtranscribe.onState((s) => set({ state: s }));
    }
    set({ state: await window.jmtranscribe.getState() });
  },
  setConfig: async (patch) => set({ state: await window.jmtranscribe.setConfig(patch) }),
  addFiles: async () => {
    await window.jmtranscribe.addFiles();
  },
  addPaths: async (paths) => {
    await window.jmtranscribe.addPaths(paths);
  },
  removeJob: async (id) => {
    await window.jmtranscribe.removeJob(id);
  },
  clearFinished: async () => {
    await window.jmtranscribe.clearFinished();
  },
  start: async () => {
    await window.jmtranscribe.start();
  },
  cancel: async (id) => {
    await window.jmtranscribe.cancel(id);
  },
  chooseOutputDir: async () => {
    await window.jmtranscribe.chooseOutputDir();
  },
  downloadModel: async (id) => {
    await window.jmtranscribe.downloadModel(id);
  },
  deleteModel: async (id) => {
    await window.jmtranscribe.deleteModel(id);
  },
}));
