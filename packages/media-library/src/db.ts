import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { migrate } from './schema';

export interface OpenLibraryOptions {
  /** Dateiname der SQLite-DB. Standard: 'library.sqlite'. */
  fileName?: string;
  /** Zielordner. Standard: <userData>/data. */
  dir?: string;
}

let db: Database.Database | null = null;

function defaultDir(): string {
  return path.join(app.getPath('userData'), 'data');
}

/**
 * Öffnet (oder erstellt) die Medienbibliothek im userData-Ordner, schaltet WAL
 * + Foreign-Keys ein und führt das Schema-Migrate aus. Idempotent — liefert bei
 * erneutem Aufruf dieselbe Verbindung. Muster wie studio-control/db/sqlite.ts,
 * nur parametrisiert.
 */
export function openLibrary(opts: OpenLibraryOptions = {}): Database.Database {
  if (db) return db;
  const dir = opts.dir ?? defaultDir();
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, opts.fileName ?? 'library.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

/** Liefert die offene Verbindung; wirft, falls openLibrary() noch nicht lief. */
export function getLibrary(): Database.Database {
  if (!db) throw new Error('Media-Library nicht geöffnet — zuerst openLibrary() aufrufen.');
  return db;
}

export function closeLibrary(): void {
  db?.close();
  db = null;
}
