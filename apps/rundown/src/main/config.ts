// Persistente Conductor-Konfiguration: manuelle Endpunkt-Overrides je Rolle
// (für Cross-Subnet / wenn mDNS nicht durchkommt). Liegt in userData.
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Endpoint } from '@shared/types';

interface RundownConfig {
  overrides: Record<string, Endpoint>;
}

function configPath(): string {
  return join(app.getPath('userData'), 'rundown.config.json');
}

let cache: RundownConfig | null = null;

export function getConfig(): RundownConfig {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as { overrides?: Record<string, Partial<Endpoint>> };
    const overrides: Record<string, Endpoint> = {};
    for (const [role, ep] of Object.entries(raw.overrides ?? {})) {
      if (ep && typeof ep.host === 'string' && typeof ep.port === 'number') {
        overrides[role] = { host: ep.host, port: ep.port };
      }
    }
    cache = { overrides };
  } catch {
    cache = { overrides: {} };
  }
  return cache;
}

export function getOverrides(): Record<string, Endpoint> {
  return getConfig().overrides;
}

/** Override setzen (host leer → entfernen). Schreibt + liefert die neue Tabelle. */
export function setOverride(role: string, host: string | null, port: number | null): Record<string, Endpoint> {
  const overrides = { ...getConfig().overrides };
  if (host && port && Number.isFinite(port)) overrides[role] = { host, port };
  else delete overrides[role];
  cache = { overrides };
  try {
    writeFileSync(configPath(), JSON.stringify(cache, null, 2));
  } catch {
    /* best-effort */
  }
  return overrides;
}
