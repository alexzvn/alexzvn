import type Database from 'better-sqlite3';

/** Aktuelle Schema-Version (PRAGMA user_version) für künftige Migrationen. */
export const SCHEMA_VERSION = 1;

/**
 * Legt das Medienbibliotheks-Schema an (idempotent). Wird von openLibrary()
 * automatisch beim Öffnen ausgeführt. Künftige Versionssprünge hängen an die
 * user_version-Weiche unten an.
 */
export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('audio','video')),
      title TEXT,
      artist TEXT,
      duration_sec REAL NOT NULL DEFAULT 0,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      format TEXT,
      codec TEXT,
      thumb_path TEXT,
      added_at INTEGER NOT NULL,
      last_played_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'playlist' CHECK (kind IN ('playlist','soundboard')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS playlist_items_idx ON playlist_items(playlist_id, position);

    CREATE TABLE IF NOT EXISTS cues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      media_id INTEGER REFERENCES media_items(id) ON DELETE SET NULL,
      label TEXT NOT NULL,
      slot INTEGER NOT NULL,
      hotkey TEXT,
      color TEXT,
      gain_db REAL NOT NULL DEFAULT 0,
      loop INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS cues_idx ON cues(playlist_id, slot);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS media_tags (
      media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (media_id, tag_id)
    );
  `);

  // user_version als Migrations-Marker setzen (idempotent).
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0;
  if (current < SCHEMA_VERSION) {
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
}
