export type MediaKind = 'audio' | 'video';
export type PlaylistKind = 'playlist' | 'soundboard';

/** Bibliotheks-Eintrag (camelCase-Sicht der media_items-Zeile). */
export interface MediaItem {
  id: number;
  path: string;
  fileName: string;
  kind: MediaKind;
  title: string | null;
  artist: string | null;
  durationSec: number;
  sizeBytes: number;
  format: string | null;
  codec: string | null;
  thumbPath: string | null;
  addedAt: number;
  lastPlayedAt: number | null;
}

export interface Playlist {
  id: number;
  name: string;
  kind: PlaylistKind;
  createdAt: number;
  updatedAt: number;
}

/** Playlist-Eintrag inkl. eingebettetem Medium (JOIN). */
export interface PlaylistItem {
  id: number;
  playlistId: number;
  mediaId: number;
  position: number;
  media: MediaItem;
}

/** Ein Soundboard-Pad inkl. (optional) zugewiesenem Medium (JOIN). */
export interface Cue {
  id: number;
  playlistId: number;
  mediaId: number | null;
  label: string;
  slot: number;
  hotkey: string | null;
  color: string | null;
  gainDb: number;
  loop: boolean;
  media: MediaItem | null;
}

export interface CueInput {
  playlistId: number;
  slot: number;
  mediaId: number | null;
  label: string;
  hotkey?: string | null;
  color?: string | null;
  gainDb?: number;
  loop?: boolean;
}

// ---- Cue-Show (QLab-artig) ----

export interface Show {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Ein Cue innerhalb einer Show inkl. Timing + eingebettetem Medium (JOIN). */
export interface ShowCue {
  id: number;
  showId: number;
  mediaId: number | null;
  label: string;
  position: number;
  /** Vorlaufzeit in s: nach GO wartet der Cue, bevor er startet. */
  preWaitSec: number;
  /** Beim Ende dieses Cues automatisch den nächsten feuern. */
  autoContinue: boolean;
  fadeInSec: number;
  fadeOutSec: number;
  gainDb: number;
  loop: boolean;
  media: MediaItem | null;
}

/** Teil-Update der editierbaren Felder eines Show-Cues. */
export interface ShowCuePatch {
  label?: string;
  preWaitSec?: number;
  autoContinue?: boolean;
  fadeInSec?: number;
  fadeOutSec?: number;
  gainDb?: number;
  loop?: boolean;
}

export interface ImportResult {
  added: number;
  skipped: number;
  failed: number;
  /** Erste Fehlermeldung (z. B. DB-Problem), falls etwas hart fehlschlug. */
  error?: string;
}

/** Shape, die der Preload auf `window.jmplay` legt. */
export interface JmplayApi {
  platform: NodeJS.Platform;
  pathForFile: (file: File) => string;
  /** Lokalen Pfad in eine vom Renderer ladbare `jmedia://`-URL übersetzen. */
  mediaUrl: (path: string) => string;
  dialog: {
    pickFolders: () => Promise<string[]>;
    pickFiles: () => Promise<string[]>;
  };
  library: {
    list: () => Promise<MediaItem[]>;
    /** Dateien oder Ordner importieren (Ordner werden rekursiv gescannt). */
    importPaths: (paths: string[]) => Promise<ImportResult>;
    remove: (id: number) => Promise<void>;
    /** Thumbnail erzeugen (falls nötig) + Pfad liefern; null wenn nicht möglich. */
    thumb: (id: number) => Promise<string | null>;
    markPlayed: (id: number) => Promise<void>;
  };
  playlists: {
    list: () => Promise<Playlist[]>;
    create: (name: string, kind?: PlaylistKind) => Promise<Playlist>;
    rename: (id: number, name: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
    items: (playlistId: number) => Promise<PlaylistItem[]>;
    addItems: (playlistId: number, mediaIds: number[]) => Promise<void>;
    removeItem: (itemId: number) => Promise<void>;
    reorder: (playlistId: number, orderedItemIds: number[]) => Promise<void>;
  };
  cues: {
    list: (playlistId: number) => Promise<Cue[]>;
    assign: (input: CueInput) => Promise<Cue>;
    clear: (playlistId: number, slot: number) => Promise<void>;
  };
  shows: {
    list: () => Promise<Show[]>;
    create: (name: string) => Promise<Show>;
    rename: (id: number, name: string) => Promise<void>;
    remove: (id: number) => Promise<void>;
    cues: (showId: number) => Promise<ShowCue[]>;
    addCues: (showId: number, mediaIds: number[]) => Promise<void>;
    removeCue: (cueId: number) => Promise<void>;
    reorder: (showId: number, orderedCueIds: number[]) => Promise<void>;
    updateCue: (cueId: number, patch: ShowCuePatch) => Promise<ShowCue>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
}
