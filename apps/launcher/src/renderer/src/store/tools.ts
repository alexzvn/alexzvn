import { create } from 'zustand';
import type { ActionResult, ToolManifest, ToolState } from '@shared/types';

function byId(states: ToolState[]): Record<string, ToolState> {
  return Object.fromEntries(states.map((s) => [s.id, s]));
}

interface ToolsStore {
  tools: ToolManifest[];
  states: Record<string, ToolState>;
  busy: Record<string, boolean>;
  loading: boolean;
  notice: string | null;
  load: () => Promise<void>;
  open: (id: string) => Promise<void>;
  install: (id: string) => Promise<void>;
  update: (id: string) => Promise<void>;
  setNotice: (notice: string | null) => void;
}

export const useTools = create<ToolsStore>((set) => {
  async function run(
    id: string,
    action: () => Promise<ActionResult>,
    refresh = false,
  ): Promise<void> {
    set((s) => ({ busy: { ...s.busy, [id]: true } }));
    try {
      const res = await action();
      if (res.message) set({ notice: res.message });
      if (refresh) {
        const states = await window.jmps.getState();
        set({ states: byId(states) });
      }
    } catch (e) {
      set({ notice: (e as Error).message });
    } finally {
      set((s) => ({ busy: { ...s.busy, [id]: false } }));
    }
  }

  return {
    tools: [],
    states: {},
    busy: {},
    loading: true,
    notice: null,
    load: async () => {
      const [tools, states] = await Promise.all([
        window.jmps.listTools(),
        window.jmps.getState(),
      ]);
      set({ tools, states: byId(states), loading: false });
    },
    open: (id) => run(id, () => window.jmps.open(id)),
    install: (id) => run(id, () => window.jmps.install(id), true),
    update: (id) => run(id, () => window.jmps.update(id), true),
    setNotice: (notice) => set({ notice }),
  };
});
