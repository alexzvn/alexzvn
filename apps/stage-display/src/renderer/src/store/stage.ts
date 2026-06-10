import { create } from 'zustand';
import type { DisplayInfo, PartialStageConfig, StageState } from '@shared/types';

interface StageStore {
  state: StageState | null;
  outputOpen: boolean;
  displays: DisplayInfo[];
  load: () => Promise<void>;
  setConfig: (patch: PartialStageConfig) => Promise<void>;
  refreshDisplays: () => Promise<void>;
  openOutput: (displayId?: number) => Promise<void>;
  closeOutput: () => Promise<void>;
}

let subscribed = false;

export const useStage = create<StageStore>((set, get) => ({
  state: null,
  outputOpen: false,
  displays: [],

  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmstage.onState((s) => set({ state: s }));
    }
    const [state, isOpen] = await Promise.all([
      window.jmstage.getState(),
      window.jmstage.output.isOpen(),
    ]);
    set({ state, outputOpen: isOpen });
    void get().refreshDisplays();
  },
  setConfig: async (patch) => {
    const s = await window.jmstage.setConfig(patch);
    set({ state: s });
  },
  refreshDisplays: async () => set({ displays: await window.jmstage.output.displays() }),
  openOutput: async (displayId) => {
    await window.jmstage.output.open(displayId);
    set({ outputOpen: true });
  },
  closeOutput: async () => {
    await window.jmstage.output.close();
    set({ outputOpen: false });
  },
}));
