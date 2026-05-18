import { TricasterClient } from './client';
import { getTricasters } from '../../config/tricasters';
import type {
  TricasterConfig,
  TricasterStatus,
} from '@shared/tricaster';

const POLL_INTERVAL_MS = 5000;

interface Entry {
  cfg: TricasterConfig;
  client: TricasterClient;
  status: TricasterStatus;
}

const entries = new Map<string, Entry>();
const listeners = new Set<(status: TricasterStatus) => void>();
let pollTimer: NodeJS.Timeout | null = null;

function emit(status: TricasterStatus): void {
  for (const l of listeners) l(status);
}

export function onStatusChange(
  cb: (status: TricasterStatus) => void,
): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAllStatuses(): TricasterStatus[] {
  return [...entries.values()].map((e) => e.status);
}

export function getClient(id: string): TricasterClient | null {
  return entries.get(id)?.client ?? null;
}

export function syncFromConfig(): void {
  const cfgs = getTricasters();
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    seen.add(cfg.id);
    const existing = entries.get(cfg.id);
    if (existing && existing.cfg.host === cfg.host && existing.cfg.port === cfg.port) {
      existing.cfg = cfg;
      continue;
    }
    const client = new TricasterClient(cfg.host, cfg.port);
    const status: TricasterStatus = {
      id: cfg.id,
      state: 'polling',
      lastChecked: 0,
    };
    entries.set(cfg.id, { cfg, client, status });
    emit(status);
  }
  for (const id of [...entries.keys()]) {
    if (!seen.has(id)) entries.delete(id);
  }
}

async function pollOne(entry: Entry): Promise<void> {
  const result = await entry.client.version();
  const next: TricasterStatus = {
    id: entry.cfg.id,
    state: result.ok ? 'connected' : 'down',
    version: result.version,
    lastChecked: Date.now(),
    lastError: result.ok ? undefined : (result.error ?? 'no response'),
  };
  const changed =
    next.state !== entry.status.state ||
    next.version !== entry.status.version ||
    next.lastError !== entry.status.lastError;
  entry.status = next;
  if (changed) emit(next);
}

export function startPolling(): void {
  if (pollTimer) return;
  const tick = (): void => {
    for (const e of entries.values()) {
      pollOne(e).catch(() => {
        // already captured as 'down'
      });
    }
  };
  tick();
  pollTimer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
