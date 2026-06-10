import { create } from 'zustand';
import type { DisplayInfo, PartialPrompterConfig, PrompterState } from '@shared/types';

interface PrompterStore {
  state: PrompterState | null;
  outputOpen: boolean;
  displays: DisplayInfo[];
  /** Marker-Positionen in em (aus der Vorschau gemessen). */
  markersEm: number[];
  load: () => Promise<void>;
  setConfig: (patch: PartialPrompterConfig) => Promise<void>;
  setMarkers: (m: number[]) => void;
  refreshDisplays: () => Promise<void>;
  openOutput: (displayId?: number) => Promise<void>;
  closeOutput: () => Promise<void>;
}

let subscribed = false;

export const usePrompter = create<PrompterStore>((set, get) => ({
  state: null,
  outputOpen: false,
  displays: [],
  markersEm: [],

  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmprompt.onState((s) => set({ state: s }));
    }
    const [state, isOpen] = await Promise.all([
      window.jmprompt.getState(),
      window.jmprompt.output.isOpen(),
    ]);
    set({ state, outputOpen: isOpen });
    void get().refreshDisplays();
  },
  setConfig: async (patch) => {
    const s = await window.jmprompt.setConfig(patch);
    set({ state: s });
  },
  setMarkers: (m) => set({ markersEm: m }),
  refreshDisplays: async () => set({ displays: await window.jmprompt.output.displays() }),
  openOutput: async (displayId) => {
    await window.jmprompt.output.open(displayId);
    set({ outputOpen: true });
  },
  closeOutput: async () => {
    await window.jmprompt.output.close();
    set({ outputOpen: false });
  },
}));
