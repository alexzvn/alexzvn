import { load, save } from './store';
import {
  PtzCameraConfigListSchema,
  type PtzCameraConfig,
  type PtzCameraConfigList,
} from '@shared/ptz';

const FILE = 'ptz-cameras.json';
let cache: PtzCameraConfigList = [];

export function loadPtzCameras(): PtzCameraConfigList {
  cache = load(FILE, PtzCameraConfigListSchema, []);
  return cache;
}

export function getPtzCameras(): PtzCameraConfigList {
  return cache;
}

export function upsertPtzCamera(cfg: PtzCameraConfig): PtzCameraConfigList {
  const idx = cache.findIndex((c) => c.id === cfg.id);
  if (idx >= 0) {
    cache = [...cache.slice(0, idx), cfg, ...cache.slice(idx + 1)];
  } else {
    cache = [...cache, cfg];
  }
  save(FILE, cache, PtzCameraConfigListSchema);
  return cache;
}

export function removePtzCamera(id: string): PtzCameraConfigList {
  cache = cache.filter((c) => c.id !== id);
  save(FILE, cache, PtzCameraConfigListSchema);
  return cache;
}
