import { create } from 'zustand';
import type { RundownDoc, RundownNav, RundownState } from '@shared/types';

interface Store {
  state: RundownState | null;
  load: () => Promise<void>;
  nav: (cmd: RundownNav) => Promise<void>;
  setDoc: (doc: RundownDoc) => Promise<void>;
  newDoc: () => Promise<void>;
  open: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  fireAction: (role: string, verb: string, args: (string | number)[]) => Promise<boolean>;
  setEndpoint: (role: string, host: string, port: number) => Promise<void>;
}

let subscribed = false;

export const useRundown = create<Store>((set) => ({
  state: null,
  load: async () => {
    if (!subscribed) {
      subscribed = true;
      // Voller Zustand (Doc/Index/Datei) bei Editor-/Navigationsänderungen …
      window.jmrundown.onState((s) => set({ state: s }));
      // … und nur die Tool-Verbindungen/Tally (häufig, ohne den ganzen Doc).
      window.jmrundown.onLinks((links) =>
        set((st) => (st.state ? { state: { ...st.state, links } } : {})),
      );
    }
    set({ state: await window.jmrundown.getState() });
  },
  nav: async (cmd) => set({ state: await window.jmrundown.nav(cmd) }),
  setDoc: async (doc) => set({ state: await window.jmrundown.setDoc(doc) }),
  newDoc: async () => set({ state: await window.jmrundown.newDoc() }),
  open: async () => set({ state: await window.jmrundown.open() }),
  save: async () => set({ state: await window.jmrundown.save() }),
  saveAs: async () => set({ state: await window.jmrundown.saveAs() }),
  fireAction: (role, verb, args) => window.jmrundown.fireAction(role, verb, args),
  setEndpoint: async (role, host, port) =>
    set({ state: await window.jmrundown.setEndpoint(role, host, port) }),
}));
