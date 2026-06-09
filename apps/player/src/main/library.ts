import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type DatabaseT from 'better-sqlite3';
import { openLibrary } from '@jm/media-library';
import { probeMedia } from '@jm/media';
import type {
  Cue,
  CueInput,
  ImportResult,
  MediaItem,
  MediaKind,
  Playlist,
  PlaylistItem,
  PlaylistKind,
} from '@shared/types';

const VIDEO_EXT = new Set([
  '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.mpg', '.mpeg', '.wmv',
]);
const AUDIO_EXT = new Set([
  '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.aif', '.aiff', '.wma',
]);

function kindForExt(ext: string): MediaKind | null {
  const e = ext.toLowerCase();
  if (VIDEO_EXT.has(e)) return 'video';
  if (AUDIO_EXT.has(e)) return 'audio';
  return null;
}

let db: DatabaseT.Database | null = null;

/** Lazy + bewusst nicht beim Start — so erscheint das Fenster auch, falls der
 *  native Treiber (better-sqlite3) mal nicht geladen werden kann. */
function database(): DatabaseT.Database {
  if (!db) db = openLibrary({ fileName: 'player.sqlite' });
  return db;
}

// ---- Row-Shapes (snake_case wie in der DB) ----

interface MediaRow {
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
  thumb_path: string | null;
  added_at: number;
  last_played_at: number | null;
}

function toItem(r: MediaRow): MediaItem {
  return {
    id: r.id,
    path: r.path,
    fileName: r.file_name,
    kind: r.kind,
    title: r.title,
    artist: r.artist,
    durationSec: r.duration_sec,
    sizeBytes: r.size_bytes,
    format: r.format,
    codec: r.codec,
    thumbPath: r.thumb_path,
    addedAt: r.added_at,
    lastPlayedAt: r.last_played_at,
  };
}

// ---- Bibliothek ----

export function listItems(): MediaItem[] {
  const rows = database()
    .prepare('SELECT * FROM media_items ORDER BY LOWER(file_name)')
    .all() as MediaRow[];
  return rows.map(toItem);
}

export function getItem(id: number): MediaItem | null {
  const row = database().prepare('SELECT * FROM media_items WHERE id = ?').get(id) as
    | MediaRow
    | undefined;
  return row ? toItem(row) : null;
}

async function collectFiles(target: string): Promise<string[]> {
  const out: string[] = [];
  let kind: 'file' | 'dir' | null = null;
  try {
    const s = await stat(target);
    kind = s.isFile() ? 'file' : s.isDirectory() ? 'dir' : null;
  } catch {
    return out;
  }

  if (kind === 'file') {
    if (kindForExt(path.extname(target))) out.push(target);
    return out;
  }
  if (kind === 'dir') {
    let names: string[];
    try {
      names = await readdir(target);
    } catch {
      return out;
    }
    for (const name of names) {
      if (name.startsWith('.')) continue;
      out.push(...(await collectFiles(path.join(target, name))));
    }
  }
  return out;
}

export async function importPaths(paths: string[]): Promise<ImportResult> {
  const files = new Set<string>();
  for (const p of paths) for (const f of await collectFiles(p)) files.add(f);

  const insert = database().prepare(
    `INSERT OR IGNORE INTO media_items
       (path, file_name, kind, title, artist, duration_sec, size_bytes, format, codec, added_at)
     VALUES (@path, @file_name, @kind, @title, @artist, @duration_sec, @size_bytes, @format, @codec, @added_at)`,
  );

  let added = 0;
  let skipped = 0;
  let failed = 0;
  const now = Date.now();

  for (const file of files) {
    const kind = kindForExt(path.extname(file));
    if (!kind) {
      skipped += 1;
      continue;
    }
    try {
      const info = await probeMedia(file);
      const stream = kind === 'video'
        ? info.streams.find((s) => s.type === 'video')
        : info.streams.find((s) => s.type === 'audio');
      const res = insert.run({
        path: file,
        file_name: info.fileName,
        kind,
        title: null,
        artist: null,
        duration_sec: info.durationSec,
        size_bytes: info.sizeBytes,
        format: info.format || null,
        codec: stream?.codec ?? null,
        added_at: now,
      });
      if (res.changes > 0) added += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }

  return { added, skipped, failed };
}

export function removeItem(id: number): void {
  database().prepare('DELETE FROM media_items WHERE id = ?').run(id);
}

export function markPlayed(id: number): void {
  database().prepare('UPDATE media_items SET last_played_at = ? WHERE id = ?').run(Date.now(), id);
}

export function setThumb(id: number, thumbPath: string): void {
  database().prepare('UPDATE media_items SET thumb_path = ? WHERE id = ?').run(thumbPath, id);
}

// ---- Playlists ----

interface PlaylistRow {
  id: number;
  name: string;
  kind: PlaylistKind;
  created_at: number;
  updated_at: number;
}

function toPlaylist(r: PlaylistRow): Playlist {
  return { id: r.id, name: r.name, kind: r.kind, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function listPlaylists(): Playlist[] {
  const rows = database()
    .prepare('SELECT * FROM playlists ORDER BY LOWER(name)')
    .all() as PlaylistRow[];
  return rows.map(toPlaylist);
}

export function createPlaylist(name: string, kind: PlaylistKind = 'playlist'): Playlist {
  const now = Date.now();
  const info = database()
    .prepare('INSERT INTO playlists (name, kind, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(name, kind, now, now);
  return {
    id: Number(info.lastInsertRowid),
    name,
    kind,
    createdAt: now,
    updatedAt: now,
  };
}

export function renamePlaylist(id: number, name: string): void {
  database()
    .prepare('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?')
    .run(name, Date.now(), id);
}

export function removePlaylist(id: number): void {
  database().prepare('DELETE FROM playlists WHERE id = ?').run(id);
}

interface PlaylistItemRow extends MediaRow {
  pi_id: number;
  pi_position: number;
}

export function playlistItems(playlistId: number): PlaylistItem[] {
  const rows = database()
    .prepare(
      `SELECT pi.id AS pi_id, pi.position AS pi_position, m.*
         FROM playlist_items pi
         JOIN media_items m ON m.id = pi.media_id
        WHERE pi.playlist_id = ?
        ORDER BY pi.position, pi.id`,
    )
    .all(playlistId) as PlaylistItemRow[];
  return rows.map((r) => ({
    id: r.pi_id,
    playlistId,
    mediaId: r.id,
    position: r.pi_position,
    media: toItem(r),
  }));
}

export function addPlaylistItems(playlistId: number, mediaIds: number[]): void {
  const dbi = database();
  const max = dbi
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM playlist_items WHERE playlist_id = ?')
    .get(playlistId) as { m: number };
  const insert = dbi.prepare(
    'INSERT INTO playlist_items (playlist_id, media_id, position) VALUES (?, ?, ?)',
  );
  let pos = max.m + 1;
  const tx = dbi.transaction((ids: number[]) => {
    for (const mediaId of ids) insert.run(playlistId, mediaId, pos++);
    dbi.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId);
  });
  tx(mediaIds);
}

export function removePlaylistItem(itemId: number): void {
  database().prepare('DELETE FROM playlist_items WHERE id = ?').run(itemId);
}

export function reorderPlaylist(playlistId: number, orderedItemIds: number[]): void {
  const dbi = database();
  const upd = dbi.prepare('UPDATE playlist_items SET position = ? WHERE id = ? AND playlist_id = ?');
  const tx = dbi.transaction((ids: number[]) => {
    ids.forEach((id, i) => upd.run(i, id, playlistId));
    dbi.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId);
  });
  tx(orderedItemIds);
}

// ---- Soundboard-Cues ----

interface CueRow {
  id: number;
  playlist_id: number;
  media_id: number | null;
  label: string;
  slot: number;
  hotkey: string | null;
  color: string | null;
  gain_db: number;
  loop: number;
}

export function listCues(playlistId: number): Cue[] {
  const rows = database()
    .prepare('SELECT * FROM cues WHERE playlist_id = ? ORDER BY slot')
    .all(playlistId) as CueRow[];
  return rows.map((r) => ({
    id: r.id,
    playlistId: r.playlist_id,
    mediaId: r.media_id,
    label: r.label,
    slot: r.slot,
    hotkey: r.hotkey,
    color: r.color,
    gainDb: r.gain_db,
    loop: r.loop !== 0,
    media: r.media_id != null ? getItem(r.media_id) : null,
  }));
}

/** Upsert eines Pads anhand (playlist, slot). */
export function assignCue(input: CueInput): Cue {
  const dbi = database();
  const existing = dbi
    .prepare('SELECT id FROM cues WHERE playlist_id = ? AND slot = ?')
    .get(input.playlistId, input.slot) as { id: number } | undefined;

  const loop = input.loop ? 1 : 0;
  const gain = input.gainDb ?? 0;
  if (existing) {
    dbi
      .prepare(
        `UPDATE cues SET media_id = ?, label = ?, hotkey = ?, color = ?, gain_db = ?, loop = ?
           WHERE id = ?`,
      )
      .run(input.mediaId, input.label, input.hotkey ?? null, input.color ?? null, gain, loop, existing.id);
  } else {
    dbi
      .prepare(
        `INSERT INTO cues (playlist_id, media_id, label, slot, hotkey, color, gain_db, loop)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.playlistId, input.mediaId, input.label, input.slot, input.hotkey ?? null, input.color ?? null, gain, loop);
  }

  const row = dbi
    .prepare('SELECT * FROM cues WHERE playlist_id = ? AND slot = ?')
    .get(input.playlistId, input.slot) as CueRow;
  return {
    id: row.id,
    playlistId: row.playlist_id,
    mediaId: row.media_id,
    label: row.label,
    slot: row.slot,
    hotkey: row.hotkey,
    color: row.color,
    gainDb: row.gain_db,
    loop: row.loop !== 0,
    media: row.media_id != null ? getItem(row.media_id) : null,
  };
}

export function clearCue(playlistId: number, slot: number): void {
  database().prepare('DELETE FROM cues WHERE playlist_id = ? AND slot = ?').run(playlistId, slot);
}
