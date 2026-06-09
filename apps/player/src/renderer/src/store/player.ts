import { create } from 'zustand';
import type { Cue, CueInput, MediaItem, Playlist, PlaylistItem, PlaylistKind } from '@shared/types';

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

  setNotice: (notice) => set({ notice }),

  load: async () => {
    const [items, playlists] = await Promise.all([
      window.jmplay.library.list(),
      window.jmplay.playlists.list(),
    ]);
    const firstSoundboard = playlists.find((p) => p.kind === 'soundboard') ?? null;
    set({ items, playlists, loading: false, soundboardId: firstSoundboard?.id ?? null });
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
}));
