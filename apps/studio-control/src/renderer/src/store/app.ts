import { create } from 'zustand';
import type {
  AtemStatusEvent,
  AudioStatusEvent,
  AuditEntry,
  ObsStatusEvent,
  PtzStatusEvent,
  TricasterStatusEvent,
} from '@shared/protocol';
import type { Device, DiscoveredDevice } from '@shared/device';
import type { TricasterConfig } from '@shared/tricaster';
import type { PtzCameraConfig } from '@shared/ptz';
import type { LightingConfig } from '@shared/lighting';
import { DEFAULT_LIGHTING_CONFIG } from '@shared/lighting';
import type { AudioConsoleConfig, ChannelState } from '@shared/audio';
import type { AtemConfig } from '@shared/atem';
import type { ObsConfig } from '@shared/obs';
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

  ptzCameras: PtzCameraConfig[];
  ptzStatuses: Record<string, PtzStatusEvent>;
  setPtzCameras: (cfg: PtzCameraConfig[], statuses: PtzStatusEvent[]) => void;
  setPtzStatus: (s: PtzStatusEvent) => void;

  lighting: LightingConfig;
  blackout: boolean;
  setLighting: (config: LightingConfig, blackout: boolean) => void;
  /** Optimistic local update of one fixture's state (live faders don't echo). */
  patchFixtureLocal: (fixtureId: string, patch: Partial<LightingConfig['fixtures'][number]['state']>) => void;

  audioConsoles: AudioConsoleConfig[];
  audioStatuses: Record<string, AudioStatusEvent>;
  setAudio: (consoles: AudioConsoleConfig[], statuses: AudioStatusEvent[]) => void;
  setAudioStatus: (s: AudioStatusEvent) => void;
  /** Optimistic local update of one channel (live faders/mutes don't echo). */
  patchChannelLocal: (consoleId: string, ch: number, patch: Partial<ChannelState>) => void;

  atem: AtemConfig[];
  atemStatuses: Record<string, AtemStatusEvent>;
  setAtem: (cfg: AtemConfig[], statuses: AtemStatusEvent[]) => void;

  obs: ObsConfig[];
  obsStatuses: Record<string, ObsStatusEvent>;
  setObs: (cfg: ObsConfig[], statuses: ObsStatusEvent[]) => void;

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

  ptzCameras: [],
  ptzStatuses: {},
  setPtzCameras: (cfg, statuses) =>
    set({
      ptzCameras: cfg,
      ptzStatuses: Object.fromEntries(statuses.map((s) => [s.id, s])),
    }),
  setPtzStatus: (s) =>
    set((st) => ({
      ptzStatuses: { ...st.ptzStatuses, [s.id]: s },
    })),

  lighting: DEFAULT_LIGHTING_CONFIG,
  blackout: false,
  setLighting: (config, blackout) => set({ lighting: config, blackout }),
  patchFixtureLocal: (fixtureId, patch) =>
    set((s) => ({
      lighting: {
        ...s.lighting,
        fixtures: s.lighting.fixtures.map((f) =>
          f.id === fixtureId ? { ...f, state: { ...f.state, ...patch } } : f,
        ),
      },
    })),

  audioConsoles: [],
  audioStatuses: {},
  setAudio: (consoles, statuses) =>
    set({
      audioConsoles: consoles,
      audioStatuses: Object.fromEntries(statuses.map((s) => [s.id, s])),
    }),
  setAudioStatus: (s) =>
    set((st) => ({ audioStatuses: { ...st.audioStatuses, [s.id]: s } })),
  patchChannelLocal: (consoleId, ch, patch) =>
    set((st) => ({
      audioConsoles: st.audioConsoles.map((c) => {
        if (c.id !== consoleId) return c;
        const prev = c.channels.find((x) => x.ch === ch);
        const next = { ch, db: prev?.db ?? 0, mute: prev?.mute ?? false, ...patch };
        const channels = [...c.channels.filter((x) => x.ch !== ch), next].sort((a, b) => a.ch - b.ch);
        return { ...c, channels };
      }),
    })),

  atem: [],
  atemStatuses: {},
  setAtem: (cfg, statuses) =>
    set({ atem: cfg, atemStatuses: Object.fromEntries(statuses.map((s) => [s.id, s])) }),

  obs: [],
  obsStatuses: {},
  setObs: (cfg, statuses) =>
    set({ obs: cfg, obsStatuses: Object.fromEntries(statuses.map((s) => [s.id, s])) }),

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
