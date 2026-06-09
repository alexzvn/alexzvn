import { load, save } from './store';
import {
  TricasterConfigListSchema,
  type TricasterConfig,
  type TricasterConfigList,
} from '@shared/tricaster';

const FILE = 'tricasters.json';
let cache: TricasterConfigList = [];

export function loadTricasters(): TricasterConfigList {
  cache = load(FILE, TricasterConfigListSchema, []);
  return cache;
}

export function getTricasters(): TricasterConfigList {
  return cache;
}

export function upsertTricaster(cfg: TricasterConfig): TricasterConfigList {
  const idx = cache.findIndex((c) => c.id === cfg.id);
  if (idx >= 0) {
    cache = [...cache.slice(0, idx), cfg, ...cache.slice(idx + 1)];
  } else {
    cache = [...cache, cfg];
  }
  save(FILE, cache, TricasterConfigListSchema);
  return cache;
}

export function removeTricaster(id: string): TricasterConfigList {
  cache = cache.filter((c) => c.id !== id);
  save(FILE, cache, TricasterConfigListSchema);
  return cache;
}
