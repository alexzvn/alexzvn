import { PanasonicPtzClient } from './client';
import { getPtzCameras } from '../../config/ptz';
import type { PtzCameraConfig, PtzStatus } from '@shared/ptz';

const POLL_INTERVAL_MS = 5000;

interface Entry {
  cfg: PtzCameraConfig;
  client: PanasonicPtzClient;
  status: PtzStatus;
}

const entries = new Map<string, Entry>();
const listeners = new Set<(status: PtzStatus) => void>();
let pollTimer: NodeJS.Timeout | null = null;

function emit(status: PtzStatus): void {
  for (const l of listeners) l(status);
}

export function onPtzStatusChange(cb: (status: PtzStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAllPtzStatuses(): PtzStatus[] {
  return [...entries.values()].map((e) => e.status);
}

export function getPtzClient(id: string): PanasonicPtzClient | null {
  return entries.get(id)?.client ?? null;
}

export function syncPtzFromConfig(): void {
  const cfgs = getPtzCameras();
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    seen.add(cfg.id);
    const existing = entries.get(cfg.id);
    if (existing && existing.cfg.host === cfg.host && existing.cfg.port === cfg.port) {
      existing.cfg = cfg;
      continue;
    }
    const client = new PanasonicPtzClient(cfg.host, cfg.port);
    const status: PtzStatus = { id: cfg.id, state: 'polling', lastChecked: 0 };
    entries.set(cfg.id, { cfg, client, status });
    emit(status);
  }
  for (const id of [...entries.keys()]) {
    if (!seen.has(id)) entries.delete(id);
  }
}

async function pollOne(entry: Entry): Promise<void> {
  const result = await entry.client.probe();
  const next: PtzStatus = {
    id: entry.cfg.id,
    state: result.ok ? 'connected' : 'down',
    power: result.power,
    lastChecked: Date.now(),
    lastError: result.ok ? undefined : (result.error ?? 'no response'),
  };
  const changed =
    next.state !== entry.status.state ||
    next.power !== entry.status.power ||
    next.lastError !== entry.status.lastError;
  entry.status = next;
  if (changed) emit(next);
}

export function startPtzPolling(): void {
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

export function stopPtzPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
