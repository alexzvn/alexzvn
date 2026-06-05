import { getDb } from '../db/sqlite';
import { hashPassword, verifyPassword } from './password';
import type { Role } from '@shared/roles';

export interface UserRow {
  id: number;
  username: string;
  role: Role;
  created_at: number;
}

interface UserWithHash extends UserRow {
  password_hash: string;
}

export function listUsers(): UserRow[] {
  return getDb()
    .prepare(`SELECT id, username, role, created_at FROM users ORDER BY username`)
    .all() as UserRow[];
}

export function findUserByUsername(username: string): UserWithHash | null {
  const row = getDb()
    .prepare(
      `SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?`,
    )
    .get(username) as UserWithHash | undefined;
  return row ?? null;
}

export function findUserById(id: number): UserRow | null {
  const row = getDb()
    .prepare(`SELECT id, username, role, created_at FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
  return row ?? null;
}

export function createUser(args: {
  username: string;
  password: string;
  role: Role;
}): UserRow {
  const hash = hashPassword(args.password);
  const now = Date.now();
  const info = getDb()
    .prepare(
      `INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)`,
    )
    .run(args.username, hash, args.role, now);
  return {
    id: Number(info.lastInsertRowid),
    username: args.username,
    role: args.role,
    created_at: now,
  };
}

export function updateUser(
  id: number,
  args: { password?: string; role?: Role },
): UserRow | null {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (args.password !== undefined) {
    sets.push('password_hash = ?');
    values.push(hashPassword(args.password));
  }
  if (args.role !== undefined) {
    sets.push('role = ?');
    values.push(args.role);
  }
  if (sets.length === 0) return findUserById(id);
  values.push(id);
  getDb()
    .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values);
  return findUserById(id);
}

export function deleteUser(id: number): void {
  getDb().prepare(`DELETE FROM users WHERE id = ?`).run(id);
}

export function verifyLogin(
  username: string,
  password: string,
): UserRow | null {
  const user = findUserByUsername(username);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
  };
}

export function countUsers(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as c FROM users`)
    .get() as { c: number };
  return row.c;
}
