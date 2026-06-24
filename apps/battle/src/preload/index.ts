import { contextBridge, ipcRenderer } from 'electron';
import type { BattleConfig, BattleState, Competitor, JmBattleApi, Side, ToolLink } from '@shared/types';

const api: JmBattleApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('battle:getState') as Promise<BattleState>,
  onState: (cb) => {
    const listener = (_e: unknown, s: BattleState): void => cb(s);
    ipcRenderer.on('battle:state', listener);
    return () => ipcRenderer.off('battle:state', listener);
  },
  onLinks: (cb) => {
    const listener = (_e: unknown, links: ToolLink[]): void => cb(links);
    ipcRenderer.on('battle:links', listener);
    return () => ipcRenderer.off('battle:links', listener);
  },

  setCompetitor: (side: Side, patch: Partial<Competitor>) =>
    ipcRenderer.invoke('battle:setCompetitor', side, patch) as Promise<BattleState>,
  swapCompetitors: () => ipcRenderer.invoke('battle:swapCompetitors') as Promise<BattleState>,

  nextRound: () => ipcRenderer.invoke('battle:nextRound') as Promise<BattleState>,
  prevRound: () => ipcRenderer.invoke('battle:prevRound') as Promise<BattleState>,
  gotoRound: (n: number) => ipcRenderer.invoke('battle:gotoRound', n) as Promise<BattleState>,
  setJuryWinner: (round: number, winner: Side | 'tie' | null) =>
    ipcRenderer.invoke('battle:setJuryWinner', round, winner) as Promise<BattleState>,
  setVotingOpen: (open: boolean) => ipcRenderer.invoke('battle:setVotingOpen', open) as Promise<BattleState>,
  clearVotes: (round: number) => ipcRenderer.invoke('battle:clearVotes', round) as Promise<BattleState>,
  setLive: (v: boolean) => ipcRenderer.invoke('battle:setLive', v) as Promise<BattleState>,
  reset: () => ipcRenderer.invoke('battle:reset') as Promise<BattleState>,

  setConfig: (patch: Partial<BattleConfig>) => ipcRenderer.invoke('battle:setConfig', patch) as Promise<BattleState>,
  setRemote: (enabled: boolean) => ipcRenderer.invoke('battle:setRemote', enabled) as Promise<BattleState>,
  setEndpoint: (role: string, host: string, port: number) =>
    ipcRenderer.invoke('battle:setEndpoint', role, host, port) as Promise<BattleState>,

  pickRecording: () => ipcRenderer.invoke('battle:pickRecording') as Promise<BattleState>,
  pickClipDir: () => ipcRenderer.invoke('battle:pickClipDir') as Promise<BattleState>,
  clip: (seconds?: number) => ipcRenderer.invoke('battle:clip', seconds) as Promise<BattleState>,
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmbattle', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmbattle = api;
}
