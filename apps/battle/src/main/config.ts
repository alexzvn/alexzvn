// Persistente Battle-Konfiguration (Runden, Voting, Clip-Einstellungen) +
// Kontrahenten-Namen + manuelle Endpunkt-Overrides. Liegt in userData. Die
// laufende Runde/Stimmen sind Live-Zustand (nicht persistiert).
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BattleConfig, Competitor, Endpoint } from '@shared/types';

export const defaultConfig: BattleConfig = {
  rounds: 3,
  votingEnabled: true,
  autoTitler: true,
  clipSeconds: 30,
  recordingPath: '',
  clipDir: '',
};

export const defaultCompetitors: { A: Competitor; B: Competitor } = {
  A: { name: 'Kontrahent A', crew: '' },
  B: { name: 'Kontrahent B', crew: '' },
};

interface Persisted {
  config: BattleConfig;
  competitors: { A: Competitor; B: Competitor };
  overrides: Record<string, Endpoint>;
}

function configPath(): string {
  return join(app.getPath('userData'), 'battle.config.json');
}

let cache: Persisted | null = null;

function load(): Persisted {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<Persisted>;
    const config = { ...defaultConfig, ...(raw.config ?? {}) };
    const competitors = {
      A: { ...defaultCompetitors.A, ...(raw.competitors?.A ?? {}) },
      B: { ...defaultCompetitors.B, ...(raw.competitors?.B ?? {}) },
    };
    const overrides: Record<string, Endpoint> = {};
    for (const [role, ep] of Object.entries(raw.overrides ?? {})) {
      if (ep && typeof ep.host === 'string' && typeof ep.port === 'number') overrides[role] = { host: ep.host, port: ep.port };
    }
    cache = { config, competitors, overrides };
  } catch {
    cache = {
      config: { ...defaultConfig },
      competitors: { A: { ...defaultCompetitors.A }, B: { ...defaultCompetitors.B } },
      overrides: {},
    };
  }
  return cache;
}

function save(): void {
  try {
    writeFileSync(configPath(), JSON.stringify(cache, null, 2));
  } catch {
    /* best-effort */
  }
}

export function getConfig(): BattleConfig {
  return load().config;
}
export function patchConfig(patch: Partial<BattleConfig>): BattleConfig {
  const c = load();
  cache = { ...c, config: { ...c.config, ...patch } };
  save();
  return cache.config;
}

export function getCompetitors(): { A: Competitor; B: Competitor } {
  return load().competitors;
}
export function setCompetitors(competitors: { A: Competitor; B: Competitor }): void {
  const c = load();
  cache = { ...c, competitors };
  save();
}

export function getOverrides(): Record<string, Endpoint> {
  return load().overrides;
}
export function setOverride(role: string, host: string | null, port: number | null): Record<string, Endpoint> {
  const c = load();
  const overrides = { ...c.overrides };
  if (host && port && Number.isFinite(port)) overrides[role] = { host, port };
  else delete overrides[role];
  cache = { ...c, overrides };
  save();
  return overrides;
}
