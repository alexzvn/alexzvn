import { create } from 'zustand';
import type {
  Cue,
  CueInput,
  MediaItem,
  Playlist,
  PlaylistItem,
  PlaylistKind,
  Show,
  ShowCue,
  ShowCuePatch,
} from '@shared/types';
import { showAudio } from '@/lib/show-audio';

// Laufende Pre-Wait-Timer der Cue-Show (modulglobal, damit Panik/Stop sie killt).
const showTimers = new Set<ReturnType<typeof setTimeout>>();
function clearShowTimers(): void {
  for (const t of showTimers) clearTimeout(t);
  showTimers.clear();
}

interface PlayerStore {
  items: MediaItem[];
  playlists: Playlist[];
  loading: boolean;
  busy: boolean;
  notice: string | null;

  // Bibliothek/Player
  activePlaylistId: number | null; // null = "Alle Medien"
  queue: PlaylistItem[];
  currentMediaId: number | null;

  // Soundboard
  soundboardId: number | null;
  cues: Cue[];

  // Cue-Show
  shows: Show[];
  activeShowId: number | null;
  showCues: ShowCue[];
  /** Index des nächsten per GO zu feuernden Cues (= „Standby"). */
  standbyIndex: number;
  /** Cue-IDs, die gerade klingen oder im Pre-Wait stehen. */
  playingCueIds: number[];
  showPaused: boolean;

  load: () => Promise<void>;
  setNotice: (s: string | null) => void;
  refreshLibrary: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;

  importFiles: () => Promise<void>;
  importFolders: () => Promise<void>;
  importPaths: (paths: string[]) => Promise<void>;
  removeItem: (id: number) => Promise<void>;

  createPlaylist: (name: string, kind?: PlaylistKind) => Promise<Playlist | null>;
  removePlaylist: (id: number) => Promise<void>;
  selectPlaylist: (id: number | null) => Promise<void>;
  addToPlaylist: (playlistId: number, mediaIds: number[]) => Promise<void>;
  removeQueueItem: (itemId: number) => Promise<void>;

  /** Liste, über die Vor/Zurück navigiert (Playlist-Queue oder ganze Bibliothek). */
  contextList: () => MediaItem[];
  play: (mediaId: number) => void;
  playNext: () => void;
  playPrev: () => void;

  selectSoundboard: (id: number) => Promise<void>;
  refreshCues: () => Promise<void>;
  assignCue: (input: CueInput) => Promise<void>;
  clearCue: (slot: number) => Promise<void>;

  // Cue-Show
  refreshShows: () => Promise<void>;
  createShow: (name: string) => Promise<Show | null>;
  renameShow: (id: number, name: string) => Promise<void>;
  removeShow: (id: number) => Promise<void>;
  selectShow: (id: number) => Promise<void>;
  refreshShowCues: () => Promise<void>;
  addShowCues: (mediaIds: number[]) => Promise<void>;
  removeShowCue: (cueId: number) => Promise<void>;
  reorderShow: (orderedCueIds: number[]) => Promise<void>;
  updateShowCue: (cueId: number, patch: ShowCuePatch) => Promise<void>;
  setStandby: (index: number) => void;
  /** Feuert intern den Cue an `index` (Pre-Wait, Audio, Auto-Continue). */
  fireCue: (index: number) => void;
  showGo: () => void;
  showStop: () => void;
  showPanic: () => void;
  showTogglePause: () => void;
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  items: [],
  playlists: [],
  loading: true,
  busy: false,
  notice: null,
  activePlaylistId: null,
  queue: [],
  currentMediaId: null,
  soundboardId: null,
  cues: [],
  shows: [],
  activeShowId: null,
  showCues: [],
  standbyIndex: 0,
  playingCueIds: [],
  showPaused: false,

  setNotice: (notice) => set({ notice }),

  load: async () => {
    const [items, playlists, shows] = await Promise.all([
      window.jmplay.library.list(),
      window.jmplay.playlists.list(),
      window.jmplay.shows.list(),
    ]);
    const firstSoundboard = playlists.find((p) => p.kind === 'soundboard') ?? null;
    set({ items, playlists, shows, loading: false, soundboardId: firstSoundboard?.id ?? null });
    if (firstSoundboard) void get().refreshCues();
  },

  refreshLibrary: async () => set({ items: await window.jmplay.library.list() }),
  refreshPlaylists: async () => set({ playlists: await window.jmplay.playlists.list() }),

  importFiles: async () => {
    const paths = await window.jmplay.dialog.pickFiles();
    if (paths.length) await get().importPaths(paths);
  },
  importFolders: async () => {
    const paths = await window.jmplay.dialog.pickFolders();
    if (paths.length) await get().importPaths(paths);
  },
  importPaths: async (paths) => {
    set({ busy: true, notice: 'Importiere…' });
    try {
      const res = await window.jmplay.library.importPaths(paths);
      await get().refreshLibrary();
      set({
        notice:
          `${res.added} hinzugefügt · ${res.skipped} übersprungen` +
          `${res.failed ? ` · ${res.failed} fehlgeschlagen` : ''}` +
          `${res.error ? ` — ${res.error}` : ''}`,
      });
    } catch (e) {
      set({ notice: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },
  removeItem: async (id) => {
    await window.jmplay.library.remove(id);
    await get().refreshLibrary();
    if (get().activePlaylistId != null) await get().selectPlaylist(get().activePlaylistId);
    if (get().currentMediaId === id) set({ currentMediaId: null });
  },

  createPlaylist: async (name, kind = 'playlist') => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const pl = await window.jmplay.playlists.create(trimmed, kind);
    await get().refreshPlaylists();
    return pl;
  },
  removePlaylist: async (id) => {
    await window.jmplay.playlists.remove(id);
    await get().refreshPlaylists();
    if (get().activePlaylistId === id) set({ activePlaylistId: null, queue: [] });
    if (get().soundboardId === id) set({ soundboardId: null, cues: [] });
  },
  selectPlaylist: async (id) => {
    if (id == null) {
      set({ activePlaylistId: null, queue: [] });
      return;
    }
    const queue = await window.jmplay.playlists.items(id);
    set({ activePlaylistId: id, queue });
  },
  addToPlaylist: async (playlistId, mediaIds) => {
    await window.jmplay.playlists.addItems(playlistId, mediaIds);
    if (get().activePlaylistId === playlistId) await get().selectPlaylist(playlistId);
    set({ notice: `${mediaIds.length} zur Playlist hinzugefügt` });
  },
  removeQueueItem: async (itemId) => {
    await window.jmplay.playlists.removeItem(itemId);
    if (get().activePlaylistId != null) await get().selectPlaylist(get().activePlaylistId);
  },

  contextList: () => {
    const { activePlaylistId, queue, items } = get();
    return activePlaylistId != null ? queue.map((q) => q.media) : items;
  },
  play: (mediaId) => {
    set({ currentMediaId: mediaId });
    void window.jmplay.library.markPlayed(mediaId);
  },
  playNext: () => {
    const list = get().contextList();
    const idx = list.findIndex((m) => m.id === get().currentMediaId);
    const next = list[idx + 1];
    if (next) get().play(next.id);
  },
  playPrev: () => {
    const list = get().contextList();
    const idx = list.findIndex((m) => m.id === get().currentMediaId);
    const prev = list[idx - 1];
    if (prev) get().play(prev.id);
  },

  selectSoundboard: async (id) => {
    set({ soundboardId: id });
    await get().refreshCues();
  },
  refreshCues: async () => {
    const id = get().soundboardId;
    if (id == null) {
      set({ cues: [] });
      return;
    }
    set({ cues: await window.jmplay.cues.list(id) });
  },
  assignCue: async (input) => {
    await window.jmplay.cues.assign(input);
    await get().refreshCues();
  },
  clearCue: async (slot) => {
    const id = get().soundboardId;
    if (id == null) return;
    await window.jmplay.cues.clear(id, slot);
    await get().refreshCues();
  },

  // ---- Cue-Show ----

  refreshShows: async () => set({ shows: await window.jmplay.shows.list() }),

  createShow: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const show = await window.jmplay.shows.create(trimmed);
    await get().refreshShows();
    await get().selectShow(show.id);
    return show;
  },
  renameShow: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await window.jmplay.shows.rename(id, trimmed);
    await get().refreshShows();
  },
  removeShow: async (id) => {
    await window.jmplay.shows.remove(id);
    await get().refreshShows();
    if (get().activeShowId === id) {
      get().showPanic();
      set({ activeShowId: null, showCues: [], standbyIndex: 0 });
    }
  },

  selectShow: async (id) => {
    get().showPanic();
    const cues = await window.jmplay.shows.cues(id);
    set({ activeShowId: id, showCues: cues, standbyIndex: 0, playingCueIds: [], showPaused: false });
    // Cue-Medien vordekodieren → latenzarmes GO.
    for (const c of cues) {
      if (c.media) void showAudio.preload(c.media.id, window.jmplay.mediaUrl(c.media.path));
    }
  },
  refreshShowCues: async () => {
    const id = get().activeShowId;
    if (id == null) return;
    const cues = await window.jmplay.shows.cues(id);
    set((s) => ({ showCues: cues, standbyIndex: Math.min(s.standbyIndex, cues.length) }));
    for (const c of cues) {
      if (c.media) void showAudio.preload(c.media.id, window.jmplay.mediaUrl(c.media.path));
    }
  },
  addShowCues: async (mediaIds) => {
    const id = get().activeShowId;
    if (id == null) return;
    await window.jmplay.shows.addCues(id, mediaIds);
    await get().refreshShowCues();
  },
  removeShowCue: async (cueId) => {
    showAudio.stop(cueId);
    await window.jmplay.shows.removeCue(cueId);
    set((s) => ({ playingCueIds: s.playingCueIds.filter((x) => x !== cueId) }));
    await get().refreshShowCues();
  },
  reorderShow: async (orderedCueIds) => {
    const id = get().activeShowId;
    if (id == null) return;
    await window.jmplay.shows.reorder(id, orderedCueIds);
    await get().refreshShowCues();
  },
  updateShowCue: async (cueId, patch) => {
    await window.jmplay.shows.updateCue(cueId, patch);
    await get().refreshShowCues();
  },

  setStandby: (index) => set({ standbyIndex: index }),

  fireCue: (index) => {
    const { showCues } = get();
    const cue = showCues[index];
    if (!cue) {
      set({ standbyIndex: showCues.length });
      return;
    }
    set({ standbyIndex: index + 1 });

    // Leerer Cue (kein Medium): ggf. direkt weiterlaufen.
    if (cue.mediaId == null || !cue.media) {
      if (cue.autoContinue) get().fireCue(index + 1);
      return;
    }

    const media = cue.media;
    const url = window.jmplay.mediaUrl(media.path);
    const startNow = (): void => {
      set((s) => ({ playingCueIds: [...new Set([...s.playingCueIds, cue.id])] }));
      void showAudio.play(cue, url, () => {
        set((s) => ({ playingCueIds: s.playingCueIds.filter((x) => x !== cue.id) }));
        if (cue.autoContinue) get().fireCue(index + 1);
      });
    };

    if (cue.preWaitSec > 0) {
      set((s) => ({ playingCueIds: [...new Set([...s.playingCueIds, cue.id])] })); // „pending"
      const t = setTimeout(() => {
        showTimers.delete(t);
        startNow();
      }, cue.preWaitSec * 1000);
      showTimers.add(t);
    } else {
      startNow();
    }
  },

  showGo: () => get().fireCue(get().standbyIndex),

  showStop: () => {
    const { showCues, playingCueIds } = get();
    for (const id of playingCueIds) {
      const cue = showCues.find((c) => c.id === id);
      showAudio.stop(id, cue?.fadeOutSec ?? 0);
    }
    clearShowTimers();
    set({ playingCueIds: [] });
  },

  showPanic: () => {
    showAudio.panic();
    clearShowTimers();
    set({ playingCueIds: [], showPaused: false });
  },

  showTogglePause: () => {
    if (get().showPaused) {
      void showAudio.resume();
      set({ showPaused: false });
    } else {
      void showAudio.suspend();
      set({ showPaused: true });
    }
  },
}));
