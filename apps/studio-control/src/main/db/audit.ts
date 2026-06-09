import { getDb } from './sqlite';
import type { AuditEntry } from '@shared/protocol';

const listeners = new Set<(entry: AuditEntry) => void>();

export function logAction(args: {
  userId: number | null;
  username: string;
  action: string;
  target?: string;
  payload?: unknown;
}): AuditEntry {
  const ts = Date.now();
  const payloadJson = args.payload === undefined ? null : JSON.stringify(args.payload);
  const info = getDb()
    .prepare(
      `INSERT INTO audit_log (ts, user_id, username, action, target, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(ts, args.userId, args.username, args.action, args.target ?? null, payloadJson);

  const entry: AuditEntry = {
    id: Number(info.lastInsertRowid),
    ts,
    username: args.username,
    action: args.action,
    target: args.target,
    payload: args.payload,
  };
  for (const l of listeners) l(entry);
  return entry;
}

export function listRecent(limit = 100): AuditEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT id, ts, username, action, target, payload_json
       FROM audit_log ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    ts: number;
    username: string;
    action: string;
    target: string | null;
    payload_json: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    username: r.username,
    action: r.action,
    target: r.target ?? undefined,
    payload: r.payload_json ? safeParse(r.payload_json) : undefined,
  }));
}

export function onAudit(cb: (entry: AuditEntry) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
