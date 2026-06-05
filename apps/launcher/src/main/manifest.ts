import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUITE } from '@jm/suite-manifest';
import type { SuiteManifest, ToolManifest } from '@jm/suite-manifest';

// In-memory-Registry. Default = gebündeltes suite.json; beim Start wird ein
// lokaler Cache geladen und optional eine remote suite.json (JMPS_MANIFEST_URL).
let cache: SuiteManifest = SUITE;

function cacheFile(): string {
  return join(app.getPath('userData'), 'manifest-cache.json');
}

function manifestUrl(): string | undefined {
  return process.env['JMPS_MANIFEST_URL'] || undefined;
}

function isValid(value: unknown): value is SuiteManifest {
  const m = value as SuiteManifest | null;
  return Boolean(m && typeof m.schemaVersion === 'number' && Array.isArray(m.tools));
}

/** Lädt einen evtl. vorhandenen lokalen Cache synchron beim Start. */
export function initManifest(): void {
  try {
    if (existsSync(cacheFile())) {
      const parsed = JSON.parse(readFileSync(cacheFile(), 'utf8'));
      if (isValid(parsed)) cache = parsed;
    }
  } catch {
    // korrupter Cache → gebündeltes Manifest behalten
  }
}

/**
 * Holt die remote suite.json (falls JMPS_MANIFEST_URL gesetzt), validiert sie,
 * cached sie und aktualisiert die In-memory-Registry. Liefert true, wenn sich
 * etwas geändert hat.
 */
export async function refreshManifest(): Promise<boolean> {
  const url = manifestUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return false;
    const parsed = (await res.json()) as unknown;
    if (!isValid(parsed)) return false;
    const changed = JSON.stringify(parsed) !== JSON.stringify(cache);
    cache = parsed;
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify(parsed, null, 2));
    return changed;
  } catch {
    return false;
  }
}

export function getTools(): ToolManifest[] {
  return cache.tools;
}

export function getTool(id: string): ToolManifest | undefined {
  return cache.tools.find((t) => t.id === id);
}
