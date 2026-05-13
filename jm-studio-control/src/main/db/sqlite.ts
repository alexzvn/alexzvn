import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

function dbPath(): string {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'studio-control.sqlite');
}

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
