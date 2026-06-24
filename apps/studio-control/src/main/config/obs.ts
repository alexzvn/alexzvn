import { load, save } from './store';
import { ObsConfigListSchema, type ObsConfig, type ObsConfigList } from '@shared/obs';

const FILE = 'obs.json';
let cache: ObsConfigList = [];

export function loadObs(): ObsConfigList {
  cache = load(FILE, ObsConfigListSchema, []);
  return cache;
}

export function getObsInstances(): ObsConfigList {
  return cache;
}

export function upsertObs(cfg: ObsConfig): ObsConfigList {
  const idx = cache.findIndex((c) => c.id === cfg.id);
  if (idx >= 0) {
    cache = [...cache.slice(0, idx), cfg, ...cache.slice(idx + 1)];
  } else {
    cache = [...cache, cfg];
  }
  save(FILE, cache, ObsConfigListSchema);
  return cache;
}

export function removeObs(id: string): ObsConfigList {
  cache = cache.filter((c) => c.id !== id);
  save(FILE, cache, ObsConfigListSchema);
  return cache;
}
