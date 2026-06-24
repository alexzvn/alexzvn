import { create } from 'zustand';
import type { BattleConfig, BattleState, Competitor, Side } from '@shared/types';

interface Store {
  state: BattleState | null;
  load: () => Promise<void>;
  setCompetitor: (side: Side, patch: Partial<Competitor>) => Promise<void>;
  swapCompetitors: () => Promise<void>;
  nextRound: () => Promise<void>;
  prevRound: () => Promise<void>;
  gotoRound: (n: number) => Promise<void>;
  setJuryWinner: (round: number, winner: Side | 'tie' | null) => Promise<void>;
  setVotingOpen: (open: boolean) => Promise<void>;
  clearVotes: (round: number) => Promise<void>;
  setLive: (v: boolean) => Promise<void>;
  reset: () => Promise<void>;
  setConfig: (patch: Partial<BattleConfig>) => Promise<void>;
  setRemote: (enabled: boolean) => Promise<void>;
  setEndpoint: (role: string, host: string, port: number) => Promise<void>;
  pickRecording: () => Promise<void>;
  pickClipDir: () => Promise<void>;
  clip: (seconds?: number) => Promise<void>;
}

let subscribed = false;

export const useBattle = create<Store>((set) => ({
  state: null,
  load: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmbattle.onState((s) => set({ state: s }));
      window.jmbattle.onLinks((links) => set((st) => (st.state ? { state: { ...st.state, links } } : {})));
    }
    set({ state: await window.jmbattle.getState() });
  },
  setCompetitor: async (side, patch) => set({ state: await window.jmbattle.setCompetitor(side, patch) }),
  swapCompetitors: async () => set({ state: await window.jmbattle.swapCompetitors() }),
  nextRound: async () => set({ state: await window.jmbattle.nextRound() }),
  prevRound: async () => set({ state: await window.jmbattle.prevRound() }),
  gotoRound: async (n) => set({ state: await window.jmbattle.gotoRound(n) }),
  setJuryWinner: async (round, winner) => set({ state: await window.jmbattle.setJuryWinner(round, winner) }),
  setVotingOpen: async (open) => set({ state: await window.jmbattle.setVotingOpen(open) }),
  clearVotes: async (round) => set({ state: await window.jmbattle.clearVotes(round) }),
  setLive: async (v) => set({ state: await window.jmbattle.setLive(v) }),
  reset: async () => set({ state: await window.jmbattle.reset() }),
  setConfig: async (patch) => set({ state: await window.jmbattle.setConfig(patch) }),
  setRemote: async (enabled) => set({ state: await window.jmbattle.setRemote(enabled) }),
  setEndpoint: async (role, host, port) => set({ state: await window.jmbattle.setEndpoint(role, host, port) }),
  pickRecording: async () => set({ state: await window.jmbattle.pickRecording() }),
  pickClipDir: async () => set({ state: await window.jmbattle.pickClipDir() }),
  clip: async (seconds) => set({ state: await window.jmbattle.clip(seconds) }),
}));
