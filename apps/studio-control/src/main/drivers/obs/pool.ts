import { ObsClient } from './client';
import { getObsInstances } from '../../config/obs';
import type { ObsConfig, ObsStatus } from '@shared/obs';

interface Entry {
  cfg: ObsConfig;
  client: ObsClient;
  status: ObsStatus;
}

const entries = new Map<string, Entry>();
const listeners = new Set<(status: ObsStatus) => void>();

function emit(status: ObsStatus): void {
  for (const l of listeners) l(status);
}

export function onObsStatusChange(cb: (status: ObsStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getObsStatuses(): ObsStatus[] {
  return [...entries.values()].map((e) => e.status);
}

export function getObsClient(id: string): ObsClient | null {
  return entries.get(id)?.client ?? null;
}

/** Verbindungen an die Konfiguration angleichen (event-getrieben, kein Polling). */
export function syncObsFromConfig(): void {
  const cfgs = getObsInstances();
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    seen.add(cfg.id);
    const existing = entries.get(cfg.id);
    if (
      existing &&
      existing.cfg.host === cfg.host &&
      existing.cfg.port === cfg.port &&
      existing.cfg.password === cfg.password
    ) {
      existing.cfg = cfg;
      continue;
    }
    if (existing) existing.client.dispose();
    const client = new ObsClient(cfg, (status) => {
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

export function stopObs(): void {
  for (const e of entries.values()) e.client.dispose();
  entries.clear();
}
