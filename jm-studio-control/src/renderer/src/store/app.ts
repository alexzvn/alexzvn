import { create } from 'zustand';
import type {
  AuditEntry,
  TricasterStatusEvent,
} from '@shared/protocol';
import type { Device, DiscoveredDevice } from '@shared/device';
import type { TricasterConfig } from '@shared/tricaster';
import type { UserRow } from '@/types/admin';

export type Section = 'video' | 'audio' | 'licht' | 'setup';

/** Stable identity for a discovered device — used for dedup and dismissal. */
export function discoveryKey(d: DiscoveredDevice): string {
  return d.mac ?? `${d.protocol}:${d.ip}`;
}

interface AppState {
  section: Section;
  setSection: (s: Section) => void;

  devices: Device[];
  setDevices: (d: Device[]) => void;

  tricasters: TricasterConfig[];
  tricasterStatuses: Record<string, TricasterStatusEvent>;
  setTricasters: (cfg: TricasterConfig[], statuses: TricasterStatusEvent[]) => void;
  setTricasterStatus: (s: TricasterStatusEvent) => void;

  discovery: {
    running: boolean;
    results: DiscoveredDevice[];
    lastDuration?: number;
  };
  setDiscoveryRunning: (running: boolean) => void;
  appendDiscoveryResults: (results: DiscoveredDevice[]) => void;
  finishDiscovery: (count: number, durationMs: number) => void;
  dismissDiscoveryResult: (key: string) => void;
  clearDiscovery: () => void;

  audit: AuditEntry[];
  setAudit: (entries: AuditEntry[]) => void;
  appendAudit: (entry: AuditEntry) => void;

  users: UserRow[];
  setUsers: (users: UserRow[]) => void;
}

export const useApp = create<AppState>((set) => ({
  section: 'video',
  setSection: (section) => set({ section }),

  devices: [],
  setDevices: (devices) => set({ devices }),

  tricasters: [],
  tricasterStatuses: {},
  setTricasters: (cfg, statuses) =>
    set({
      tricasters: cfg,
      tricasterStatuses: Object.fromEntries(statuses.map((s) => [s.id, s])),
    }),
  setTricasterStatus: (s) =>
    set((st) => ({
      tricasterStatuses: { ...st.tricasterStatuses, [s.id]: s },
    })),

  discovery: { running: false, results: [] },
  setDiscoveryRunning: (running) =>
    set((s) => ({ discovery: { ...s.discovery, running, results: running ? [] : s.discovery.results } })),
  appendDiscoveryResults: (results) =>
    set((s) => {
      const merged = new Map<string, DiscoveredDevice>();
      for (const d of s.discovery.results) merged.set(discoveryKey(d), d);
      for (const d of results) merged.set(discoveryKey(d), d);
      return { discovery: { ...s.discovery, results: [...merged.values()] } };
    }),
  finishDiscovery: (count, durationMs) =>
    set((s) => ({ discovery: { ...s.discovery, running: false, lastDuration: durationMs, results: s.discovery.results } })),
  dismissDiscoveryResult: (key) =>
    set((s) => ({
      discovery: {
        ...s.discovery,
        results: s.discovery.results.filter((d) => discoveryKey(d) !== key),
      },
    })),
  clearDiscovery: () =>
    set((s) => ({ discovery: { ...s.discovery, results: [] } })),

  audit: [],
  setAudit: (entries) => set({ audit: entries }),
  appendAudit: (entry) =>
    set((s) => ({ audit: [entry, ...s.audit].slice(0, 200) })),

  users: [],
  setUsers: (users) => set({ users }),
}));
