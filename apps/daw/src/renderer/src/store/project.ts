import { create } from 'zustand';
import {
  clipDurationUs,
  clipEndUs,
  makeAudioTrack,
  makeEmptyProject,
  newId,
  projectDurationUs,
  trackEndUs,
  type Clip,
  type ClipFade,
  type MediaAsset,
  type Project,
  type Track,
} from '@shared/project';
import type { RecorderState, RecorderStatus } from '@shared/ipc-types';
import { snapSourceUsToZero } from '@/lib/zerocross';

const HISTORY_CAP = 50;

export interface ExportStatus {
  running: boolean;
  percent: number;
  exportId?: string;
  message?: string;
  lastOutput?: string;
  error?: string;
}

/** Aufnahme-UI-Status (gespiegelt vom Main + Renderer-Zusatz). */
export interface RecUiState {
  status: RecorderStatus;
  /** Ziel-Spur, auf die aufgenommen wird. */
  targetTrackId: string | null;
  deviceIndex: number | null;
  channels: number;
  sampleRate: number;
  /** Timeline-Position, an der die Aufnahme begann (µs). */
  startUs: number;
  recordedSec: number;
  /** Letzte Spitzenpegel (linear 0..1) je Kanal. */
  levels: number[];
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
  /** Aktive Ziel-Spur (Import/Aufnahme landet hier). null = erste Spur. */
  activeTrackId: string | null;
  /** Schnitte/Trims auf den nächsten Nulldurchgang einrasten. */
  zeroCrossEnabled: boolean;

  exportStatus: ExportStatus;
  rec: RecUiState;

  // intern: Snapshot vor einer Drag-/Mix-Interaktion
  _dragBefore: Project | null;

  // ── Projekt / History ─────────────────────────────────────────────────────
  newProject: () => void;
  loadProject: (path: string, project: Project) => void;
  commit: (label: string, mutate: (draft: Project) => void) => void;
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
  setZeroCross: (on: boolean) => void;

  // ── Spuren ────────────────────────────────────────────────────────────────
  setActiveTrack: (trackId: string) => void;
  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;

  // ── Bearbeiten ────────────────────────────────────────────────────────────
  addAssets: (assets: MediaAsset[]) => void;
  addAssetToTimeline: (assetId: string, atUs?: number, trackId?: string) => void;
  splitAtPlayhead: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  updateClip: (clipId: string, patch: Partial<Clip>, label?: string) => void;
  setClipFade: (clipId: string, fade: ClipFade) => void;

  setExportStatus: (patch: Partial<ExportStatus>) => void;

  // ── Aufnahme ──────────────────────────────────────────────────────────────
  setRecConfig: (patch: Partial<Pick<RecUiState, 'targetTrackId' | 'deviceIndex' | 'channels' | 'sampleRate'>>) => void;
  setRecFromMain: (s: RecorderState) => void;
  setRecLevels: (levels: number[]) => void;
  setRecError: (error?: string) => void;
  markRecStart: () => void;
  placeRecordedAsset: (asset: MediaAsset) => void;
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

/** Aktive Ziel-Spur (oder erste Spur als Fallback). */
function resolveTrack(project: Project, activeId: string | null, explicitId?: string): Track | undefined {
  if (explicitId) {
    const t = project.tracks.find((tt) => tt.id === explicitId);
    if (t) return t;
  }
  if (activeId) {
    const t = project.tracks.find((tt) => tt.id === activeId);
    if (t) return t;
  }
  return project.tracks[0];
}

const initialRec = (): RecUiState => ({
  status: 'idle',
  targetTrackId: null,
  deviceIndex: null,
  channels: 2,
  sampleRate: 48_000,
  startUs: 0,
  recordedSec: 0,
  levels: [],
});

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
  activeTrackId: null,
  zeroCrossEnabled: true,
  exportStatus: { running: false, percent: 0 },
  rec: initialRec(),
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
      activeTrackId: null,
      rec: initialRec(),
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
      activeTrackId: null,
      rec: initialRec(),
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
  setZeroCross: (on) => set({ zeroCrossEnabled: on }),

  // ── Spuren ────────────────────────────────────────────────────────────────
  setActiveTrack: (trackId) => set({ activeTrackId: trackId }),

  addTrack: () => {
    const id = newId('trk');
    get().commit('Spur hinzufügen', (draft) => {
      const track = makeAudioTrack(`Spur ${draft.tracks.length + 1}`);
      track.id = id;
      draft.tracks.push(track);
    });
    set({ activeTrackId: id });
  },

  removeTrack: (trackId) => {
    if (get().present.tracks.length <= 1) return; // mindestens eine Spur
    get().commit('Spur entfernen', (draft) => {
      draft.tracks = draft.tracks.filter((t) => t.id !== trackId);
    });
    if (get().activeTrackId === trackId) set({ activeTrackId: null });
  },

  renameTrack: (trackId, name) =>
    get().commit('Spur umbenennen', (draft) => {
      const t = draft.tracks.find((tt) => tt.id === trackId);
      if (t) t.name = name;
    }),

  toggleMute: (trackId) =>
    get().commit('Spur stummschalten', (draft) => {
      const t = draft.tracks.find((tt) => tt.id === trackId);
      if (t) t.muted = !t.muted;
    }),

  toggleSolo: (trackId) =>
    get().commit('Spur solo', (draft) => {
      const t = draft.tracks.find((tt) => tt.id === trackId);
      if (t) t.solo = !t.solo;
    }),

  // ── Bearbeiten ────────────────────────────────────────────────────────────
  addAssets: (assets) =>
    set((state) => {
      const before = clone(state.present);
      const draft = clone(state.present);
      draft.assets.push(...assets);
      return { present: draft, dirty: true, ...pushHistory(state, before) };
    }),

  addAssetToTimeline: (assetId, atUs, trackId) =>
    get().commit('Clip hinzufügen', (draft) => {
      const asset = draft.assets.find((a) => a.id === assetId);
      if (!asset) return;
      const track = resolveTrack(draft, get().activeTrackId, trackId);
      if (!track) return;
      const start = atUs ?? trackEndUs(track);
      track.clips.push({
        id: newId('clip'),
        assetId,
        inUs: 0,
        outUs: asset.durationUs,
        startUs: Math.max(0, start),
        gain: 1,
        enabled: true,
      });
    }),

  splitAtPlayhead: () => {
    const { present, playheadUs } = get();
    const loc = locateClip(present, get().selectedClipId);
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
    const offset = playheadUs - c.startUs;
    const zeroCross = get().zeroCrossEnabled;
    get().commit('Clip teilen', (draft) => {
      const track = draft.tracks.find((tt) => tt.id === t.id);
      const clip = track?.clips.find((cc) => cc.id === c.id);
      if (!track || !clip) return;
      // Quell-Schnittpunkt (optional auf Nulldurchgang gerastet, in Clipgrenzen).
      const rawCut = clip.inUs + offset;
      const snapped = zeroCross ? snapSourceUsToZero(clip.assetId, rawCut) : rawCut;
      const cutSource = Math.min(Math.max(snapped, clip.inUs + 1), clip.outUs - 1);
      const cutOffset = cutSource - clip.inUs; // Timeline-Offset ab Clipanfang
      const right: Clip = {
        ...structuredClone(clip),
        id: newId('clip'),
        inUs: cutSource,
        startUs: clip.startUs + cutOffset,
        fade: clip.fade ? { inUs: 0, outUs: clip.fade.outUs } : undefined,
      };
      clip.outUs = cutSource;
      if (clip.fade) clip.fade = { inUs: clip.fade.inUs, outUs: 0 };
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

  duplicateSelected: () => {
    const id = get().selectedClipId;
    if (!id) return;
    let copyId: string | null = null;
    get().commit('Clip duplizieren', (draft) => {
      for (const track of draft.tracks) {
        const idx = track.clips.findIndex((c) => c.id === id);
        if (idx >= 0) {
          const src = track.clips[idx];
          const copy: Clip = { ...structuredClone(src), id: newId('clip'), startUs: clipEndUs(src) };
          copyId = copy.id;
          track.clips.push(copy);
          break;
        }
      }
    });
    if (copyId) set({ selectedClipId: copyId });
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

  setClipFade: (clipId, fade) => get().updateClip(clipId, { fade }, 'Blende ändern'),

  setExportStatus: (patch) => set((state) => ({ exportStatus: { ...state.exportStatus, ...patch } })),

  // ── Aufnahme ──────────────────────────────────────────────────────────────
  setRecConfig: (patch) => set((state) => ({ rec: { ...state.rec, ...patch } })),

  setRecFromMain: (s) =>
    set((state) => ({
      rec: {
        ...state.rec,
        status: s.status,
        channels: s.channels || state.rec.channels,
        sampleRate: s.sampleRate || state.rec.sampleRate,
        recordedSec: s.recordedSec,
      },
    })),

  setRecLevels: (levels) => set((state) => ({ rec: { ...state.rec, levels } })),
  setRecError: (error) => set((state) => ({ rec: { ...state.rec, error } })),

  markRecStart: () =>
    set((state) => ({
      rec: { ...state.rec, startUs: state.playheadUs, targetTrackId: state.rec.targetTrackId ?? state.present.tracks[0]?.id ?? null },
    })),

  placeRecordedAsset: (asset) => {
    const { rec } = get();
    set((state) => {
      const before = clone(state.present);
      const draft = clone(state.present);
      draft.assets.push(asset);
      const track = resolveTrack(draft, rec.targetTrackId, rec.targetTrackId ?? undefined);
      if (track) {
        track.clips.push({
          id: newId('clip'),
          assetId: asset.id,
          inUs: 0,
          outUs: asset.durationUs,
          startUs: Math.max(0, rec.startUs),
          gain: 1,
          enabled: true,
        });
      }
      return { present: draft, dirty: true, ...pushHistory(state, before) };
    });
  },
}));

// ── Abgeleitete Selektoren (reine Funktionen) ────────────────────────────────
export { clipDurationUs, clipEndUs, projectDurationUs };
