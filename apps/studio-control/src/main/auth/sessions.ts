import crypto from 'node:crypto';
import { getDb } from '../db/sqlite';
import { findUserById, type UserRow } from './users';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface SessionRow {
  token: string;
  user_id: number;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
}

export function createSession(userId: number): {
  token: string;
  expiresAt: number;
} {
  const token = newToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  getDb()
    .prepare(
      `INSERT INTO sessions (token, user_id, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(token, userId, now, expiresAt, now);
  return { token, expiresAt };
}

export function validateSession(token: string | undefined | null): UserRow | null {
  if (!token) return null;
  const row = getDb()
    .prepare(`SELECT token, user_id, expires_at FROM sessions WHERE token = ?`)
    .get(token) as
    | { token: string; user_id: number; expires_at: number }
    | undefined;
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at < now) {
    getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }
  // Touch last_seen_at (best-effort, swallow errors).
  try {
    getDb()
      .prepare(`UPDATE sessions SET last_seen_at = ? WHERE token = ?`)
      .run(now, token);
  } catch {
    // ignore
  }
  return findUserById(row.user_id);
}

export function revokeSession(token: string): void {
  getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function revokeAllSessionsForUser(userId: number): void {
  getDb().prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

export function purgeExpired(): void {
  getDb().prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(Date.now());
}
