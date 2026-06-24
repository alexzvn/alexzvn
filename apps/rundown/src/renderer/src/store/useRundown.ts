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
}

let subscribed = false;

export const useRundown = create<Store>((set) => ({
  state: null,
  load: async () => {
    if (!subscribed) {
      subscribed = true;
      // Main broadcastet bei jeder Änderung (Navigation, Discovery, Editor).
      window.jmrundown.onState((s) => set({ state: s }));
    }
    set({ state: await window.jmrundown.getState() });
  },
  nav: async (cmd) => set({ state: await window.jmrundown.nav(cmd) }),
  setDoc: async (doc) => set({ state: await window.jmrundown.setDoc(doc) }),
  newDoc: async () => set({ state: await window.jmrundown.newDoc() }),
  open: async () => set({ state: await window.jmrundown.open() }),
  save: async () => set({ state: await window.jmrundown.save() }),
  saveAs: async () => set({ state: await window.jmrundown.saveAs() }),
}));
