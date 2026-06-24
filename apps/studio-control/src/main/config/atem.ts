import { load, save } from './store';
import { AtemConfigListSchema, type AtemConfig, type AtemConfigList } from '@shared/atem';

const FILE = 'atem.json';
let cache: AtemConfigList = [];

export function loadAtem(): AtemConfigList {
  cache = load(FILE, AtemConfigListSchema, []);
  return cache;
}

export function getAtemInstances(): AtemConfigList {
  return cache;
}

export function upsertAtem(cfg: AtemConfig): AtemConfigList {
  const idx = cache.findIndex((c) => c.id === cfg.id);
  if (idx >= 0) {
    cache = [...cache.slice(0, idx), cfg, ...cache.slice(idx + 1)];
  } else {
    cache = [...cache, cfg];
  }
  save(FILE, cache, AtemConfigListSchema);
  return cache;
}

export function removeAtem(id: string): AtemConfigList {
  cache = cache.filter((c) => c.id !== id);
  save(FILE, cache, AtemConfigListSchema);
  return cache;
}
