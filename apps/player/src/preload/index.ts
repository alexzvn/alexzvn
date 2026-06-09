import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  Cue,
  CueInput,
  ImportResult,
  JmplayApi,
  MediaItem,
  Playlist,
  PlaylistItem,
  PlaylistKind,
  Show,
  ShowCue,
  ShowCuePatch,
} from '@shared/types';
import { mediaUrl } from '@shared/media-url';

const api: JmplayApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  mediaUrl,
  dialog: {
    pickFolders: () => ipcRenderer.invoke('dialog:pickFolders') as Promise<string[]>,
    pickFiles: () => ipcRenderer.invoke('dialog:pickFiles') as Promise<string[]>,
  },
  library: {
    list: () => ipcRenderer.invoke('library:list') as Promise<MediaItem[]>,
    importPaths: (paths) => ipcRenderer.invoke('library:import', paths) as Promise<ImportResult>,
    remove: (id) => ipcRenderer.invoke('library:remove', id) as Promise<void>,
    thumb: (id) => ipcRenderer.invoke('library:thumb', id) as Promise<string | null>,
    markPlayed: (id) => ipcRenderer.invoke('library:markPlayed', id) as Promise<void>,
  },
  playlists: {
    list: () => ipcRenderer.invoke('playlists:list') as Promise<Playlist[]>,
    create: (name, kind?: PlaylistKind) =>
      ipcRenderer.invoke('playlists:create', name, kind) as Promise<Playlist>,
    rename: (id, name) => ipcRenderer.invoke('playlists:rename', id, name) as Promise<void>,
    remove: (id) => ipcRenderer.invoke('playlists:remove', id) as Promise<void>,
    items: (playlistId) => ipcRenderer.invoke('playlists:items', playlistId) as Promise<PlaylistItem[]>,
    addItems: (playlistId, mediaIds) =>
      ipcRenderer.invoke('playlists:addItems', playlistId, mediaIds) as Promise<void>,
    removeItem: (itemId) => ipcRenderer.invoke('playlists:removeItem', itemId) as Promise<void>,
    reorder: (playlistId, orderedItemIds) =>
      ipcRenderer.invoke('playlists:reorder', playlistId, orderedItemIds) as Promise<void>,
  },
  cues: {
    list: (playlistId) => ipcRenderer.invoke('cues:list', playlistId) as Promise<Cue[]>,
    assign: (input: CueInput) => ipcRenderer.invoke('cues:assign', input) as Promise<Cue>,
    clear: (playlistId, slot) => ipcRenderer.invoke('cues:clear', playlistId, slot) as Promise<void>,
  },
  shows: {
    list: () => ipcRenderer.invoke('shows:list') as Promise<Show[]>,
    create: (name) => ipcRenderer.invoke('shows:create', name) as Promise<Show>,
    rename: (id, name) => ipcRenderer.invoke('shows:rename', id, name) as Promise<void>,
    remove: (id) => ipcRenderer.invoke('shows:remove', id) as Promise<void>,
    cues: (showId) => ipcRenderer.invoke('shows:cues', showId) as Promise<ShowCue[]>,
    addCues: (showId, mediaIds) =>
      ipcRenderer.invoke('shows:addCues', showId, mediaIds) as Promise<void>,
    removeCue: (cueId) => ipcRenderer.invoke('shows:removeCue', cueId) as Promise<void>,
    reorder: (showId, orderedCueIds) =>
      ipcRenderer.invoke('shows:reorder', showId, orderedCueIds) as Promise<void>,
    updateCue: (cueId, patch: ShowCuePatch) =>
      ipcRenderer.invoke('shows:updateCue', cueId, patch) as Promise<ShowCue>,
  },
  shell: {
    reveal: (filePath) => ipcRenderer.invoke('shell:reveal', filePath) as Promise<void>,
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmplay', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmplay = api;
}
