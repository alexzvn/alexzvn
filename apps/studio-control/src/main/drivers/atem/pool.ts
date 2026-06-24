import { AtemClient } from './client';
import { getAtemInstances } from '../../config/atem';
import type { AtemConfig, AtemStatus } from '@shared/atem';

interface Entry {
  cfg: AtemConfig;
  client: AtemClient;
  status: AtemStatus;
}

const entries = new Map<string, Entry>();
const listeners = new Set<(status: AtemStatus) => void>();

function emit(status: AtemStatus): void {
  for (const l of listeners) l(status);
}

export function onAtemStatusChange(cb: (status: AtemStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAtemStatuses(): AtemStatus[] {
  return [...entries.values()].map((e) => e.status);
}

export function getAtemClient(id: string): AtemClient | null {
  return entries.get(id)?.client ?? null;
}

/** Verbindungen an die Konfiguration angleichen (event-getrieben, kein Polling). */
export function syncAtemFromConfig(): void {
  const cfgs = getAtemInstances();
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    seen.add(cfg.id);
    const existing = entries.get(cfg.id);
    if (existing && existing.cfg.host === cfg.host) {
      existing.cfg = cfg;
      continue;
    }
    if (existing) existing.client.dispose();
    const client = new AtemClient(cfg, (status) => {
      const e = entries.get(cfg.id);
      if (e) {
        e.status = status;
        emit(status);
      }
    });
    entries.set(cfg.id, { cfg, client, status: client.getStatus() });
    emit(client.getStatus());
  }
  for (const id of [...entries.keys()]) {
    if (!seen.has(id)) {
      entries.get(id)?.client.dispose();
      entries.delete(id);
    }
  }
}

export function stopAtem(): void {
  for (const e of entries.values()) e.client.dispose();
  entries.clear();
}
