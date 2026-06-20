import { create } from 'zustand';
import {
  clipDurationUs,
  clipEndUs,
  getVideoTrack,
  makeEmptyProject,
  newId,
  projectDurationUs,
  secToUs,
  sortedClips,
  trackEndUs,
  type Clip,
  type MediaAsset,
  type Project,
  type TitleSpec,
  type Track,
} from '@shared/project';
import type { ProxyProgress, ProxyResult } from '@shared/ipc-types';

const HISTORY_CAP = 50;

export interface ProxyStatus {
  state: 'none' | 'building' | 'ready' | 'failed';
  percent: number;
}

export interface ExportStatus {
  running: boolean;
  percent: number;
  etaSec?: number;
  exportId?: string;
  message?: string;
  lastOutput?: string;
  error?: string;
}

interface State {
  present: Project;
  past: Project[];
  future: Project[];
  filePath: string | null;
  dirty: boolean;

  selectedClipId: string | null;
  playheadUs: number;
  playing: boolean;
  pxPerSec: number;

  proxies: Record<string, ProxyStatus>;
  exportStatus: ExportStatus;

  // intern: Snapshot vor einer Drag-Interaktion
  _dragBefore: Project | null;

  // ── Projekt / History ─────────────────────────────────────────────────────
  newProject: () => void;
  loadProject: (path: string, project: Project) => void;
  commit: (label: string, mutate: (draft: Project) => void) => void;
  /** Projektänderung OHNE History (Metadaten wie Proxy-Pfade). */
  patchProject: (mutate: (draft: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  beginDrag: () => void;
  dragUpdate: (mutate: (draft: Project) => void) => void;
  endDrag: () => void;

  // ── Auswahl / Transport ───────────────────────────────────────────────────
  select: (clipId: string | null) => void;
  setPlayhead: (us: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (pxPerSec: number) => void;

  // ── Bearbeiten ────────────────────────────────────────────────────────────
  addAssets: (assets: MediaAsset[]) => void;
  addAssetToTimeline: (assetId: string) => void;
  addTitle: () => void;
  splitAtPlayhead: () => void;
  deleteSelected: () => void;
  updateClip: (clipId: string, patch: Partial<Clip>, label?: string) => void;
  setExportStatus: (patch: Partial<ExportStatus>) => void;
  setProxyProgress: (p: ProxyProgress) => void;
  setProxyDone: (r: ProxyResult) => void;
}

const clone = (p: Project): Project => structuredClone(p);

function pushHistory(state: State, before: Project): Partial<State> {
  const past = [...state.past, before];
  if (past.length > HISTORY_CAP) past.shift();
  return { past, future: [] };
}

/** Finde Clip + Spur per ID. */
export function locateClip(project: Project, clipId: string | null): { track: Track; clip: Clip } | null {
  if (!clipId) return null;
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

export const useProject = create<State>((set, get) => ({
  present: makeEmptyProject(),
  past: [],
  future: [],
  filePath: null,
  dirty: false,
  selectedClipId: null,
  playheadUs: 0,
  playing: false,
  pxPerSec: 90,
  proxies: {},
  exportStatus: { running: false, percent: 0 },
  _dragBefore: null,

  newProject: () =>
    set({
      present: makeEmptyProject(),
      past: [],
      future: [],
      filePath: null,
      dirty: false,
      selectedClipId: null,
      playheadUs: 0,
      playing: false,
    }),

  loadProject: (path, project) =>
    set({
      present: project,
      past: [],
      future: [],
      filePath: path,
      dirty: false,
      selectedClipId: null,
      playheadUs: 0,
      playing: false,
    }),

  commit: (_label, mutate) =>
    set((state) => {
      const before = clone(state.present);
      const draft = clone(state.present);
      mutate(draft);
      return { present: draft, dirty: true, ...pushHistory(state, before) };
    }),

  patchProject: (mutate) =>
    set((state) => {
      const draft = clone(state.present);
      mutate(draft);
      return { present: draft };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const past = [...state.past];
      const prev = past.pop()!;
      return { present: prev, past, future: [clone(state.present), ...state.future], dirty: true };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const future = [...state.future];
      const next = future.shift()!;
      return { present: next, future, past: [...state.past, clone(state.present)], dirty: true };
    }),

  beginDrag: () => set((state) => ({ _dragBefore: clone(state.present) })),
  dragUpdate: (mutate) =>
    set((state) => {
      const draft = clone(state.present);
      mutate(draft);
      return { present: draft, dirty: true };
    }),
  endDrag: () =>
    set((state) => {
      if (!state._dragBefore) return {};
      return { ...pushHistory(state, state._dragBefore), _dragBefore: null };
    }),

  select: (clipId) => set({ selectedClipId: clipId }),
  setPlayhead: (us) =>
    set((state) => ({ playheadUs: Math.max(0, Math.min(us, Math.max(0, projectDurationUs(state.present)))) })),
  setPlaying: (playing) => set({ playing }),
  setZoom: (pxPerSec) => set({ pxPerSec: Math.max(8, Math.min(600, pxPerSec)) }),

  addAssets: (assets) =>
    set((state) => {
      const before = clone(state.present);
      const draft = clone(state.present);
      draft.assets.push(...assets);
      return { present: draft, dirty: true, ...pushHistory(state, before) };
    }),

  addAssetToTimeline: (assetId) =>
    get().commit('Clip hinzufügen', (draft) => {
      const asset = draft.assets.find((a) => a.id === assetId);
      if (!asset) return;
      const wantVideo = asset.hasVideo;
      const track = draft.tracks.find((t) => t.kind === (wantVideo ? 'video' : 'audio'));
      if (!track) return;
      const start = trackEndUs(track);
      track.clips.push({
        id: newId('clip'),
        kind: 'media',
        assetId,
        inUs: 0,
        outUs: asset.durationUs,
        startUs: start,
        gain: 1,
        transform: { scaleMode: 'fit' },
        enabled: true,
      });
    }),

  addTitle: () =>
    get().commit('Titel hinzufügen', (draft) => {
      const track = draft.tracks.find((t) => t.kind === 'overlay');
      if (!track) return;
      const title: TitleSpec = {
        text: 'Vorname Nachname',
        subtitle: 'Funktion',
        style: { fontSize: 56, color: '#ffffff', background: '#000000cc', x: 0.07, y: 0.86, bold: true },
      };
      const start = get().playheadUs;
      track.clips.push({
        id: newId('clip'),
        kind: 'title',
        inUs: 0,
        outUs: secToUs(5),
        startUs: start,
        title,
        enabled: true,
      });
    }),

  splitAtPlayhead: () => {
    const { present, playheadUs } = get();
    const loc = locateClip(present, get().selectedClipId);
    // Splitte den ausgewählten Clip, sonst den Clip unter dem Playhead auf der Videospur.
    let target = loc;
    if (!target || playheadUs <= target.clip.startUs || playheadUs >= clipEndUs(target.clip)) {
      target = null;
      for (const track of present.tracks) {
        const clip = track.clips.find((c) => playheadUs > c.startUs && playheadUs < clipEndUs(c));
        if (clip) {
          target = { track, clip };
          break;
        }
      }
    }
    if (!target) return;
    const { track: t, clip: c } = target;
    const offset = playheadUs - c.startUs; // in Timeline-µs ab Clipanfang
    get().commit('Clip teilen', (draft) => {
      const track = draft.tracks.find((tt) => tt.id === t.id);
      const clip = track?.clips.find((cc) => cc.id === c.id);
      if (!track || !clip) return;
      const cutSource = clip.inUs + offset;
      const right: Clip = {
        ...structuredClone(clip),
        id: newId('clip'),
        inUs: cutSource,
        startUs: clip.startUs + offset,
        transitionIn: undefined,
      };
      clip.outUs = cutSource;
      track.clips.push(right);
    });
  },

  deleteSelected: () => {
    const id = get().selectedClipId;
    if (!id) return;
    get().commit('Clip löschen', (draft) => {
      for (const track of draft.tracks) {
        const idx = track.clips.findIndex((c) => c.id === id);
        if (idx >= 0) {
          track.clips.splice(idx, 1);
          break;
        }
      }
    });
    set({ selectedClipId: null });
  },

  updateClip: (clipId, patch, label = 'Clip ändern') =>
    get().commit(label, (draft) => {
      for (const track of draft.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          Object.assign(clip, patch);
          break;
        }
      }
    }),

  setExportStatus: (patch) => set((state) => ({ exportStatus: { ...state.exportStatus, ...patch } })),

  setProxyProgress: (p) =>
    set((state) => ({ proxies: { ...state.proxies, [p.assetId]: { state: 'building', percent: p.percent } } })),

  setProxyDone: (r) => {
    set((state) => ({
      proxies: { ...state.proxies, [r.assetId]: { state: r.success ? 'ready' : 'failed', percent: 100 } },
    }));
    if (r.success && r.proxyPath) {
      get().patchProject((draft) => {
        const asset = draft.assets.find((a) => a.id === r.assetId);
        if (asset) {
          asset.proxyPath = r.proxyPath;
          asset.proxyState = 'ready';
        }
      });
    }
  },
}));

// ── Abgeleitete Selektoren (außerhalb des Stores, reine Funktionen) ──────────

export { clipDurationUs, clipEndUs, projectDurationUs, sortedClips, getVideoTrack };
