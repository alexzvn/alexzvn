// Zeilen-Typen der Medienbibliothek. Snake_case-Spalten wie in der DB —
// das Mapping nach camelCase überlässt jede App ihrer eigenen Schicht.

export type MediaKind = 'audio' | 'video';
export type PlaylistKind = 'playlist' | 'soundboard';

export interface MediaItemRow {
  id: number;
  path: string;
  file_name: string;
  kind: MediaKind;
  title: string | null;
  artist: string | null;
  duration_sec: number;
  size_bytes: number;
  format: string | null;
  codec: string | null;
  /** Pfad zu einem generierten Thumbnail/Waveform-Cache (via @jm/media). */
  thumb_path: string | null;
  added_at: number;
  last_played_at: number | null;
}

export interface PlaylistRow {
  id: number;
  name: string;
  kind: PlaylistKind;
  created_at: number;
  updated_at: number;
}

export interface PlaylistItemRow {
  id: number;
  playlist_id: number;
  media_id: number;
  position: number;
}

/** Ein Soundboard-Pad: an einen Grid-Slot gebundener Sofort-Cue (Theatergong). */
export interface CueRow {
  id: number;
  playlist_id: number;
  media_id: number | null;
  label: string;
  /** Position im Soundboard-Grid. */
  slot: number;
  /** z. B. "F1", "Ctrl+1" — vom Player auf einen Tastendruck gemappt. */
  hotkey: string | null;
  color: string | null;
  gain_db: number;
  /** 0/1 — als Loop abspielen. */
  loop: number;
}

export interface TagRow {
  id: number;
  name: string;
}
