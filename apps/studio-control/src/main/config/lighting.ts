import { load, save } from './store';
import {
  DEFAULT_LIGHTING_CONFIG,
  LightingConfigSchema,
  type LightingConfig,
} from '@shared/lighting';

const FILE = 'lighting.json';
let cache: LightingConfig = DEFAULT_LIGHTING_CONFIG;

export function loadLighting(): LightingConfig {
  cache = load(FILE, LightingConfigSchema, DEFAULT_LIGHTING_CONFIG);
  return cache;
}

export function getLighting(): LightingConfig {
  return cache;
}

export function saveLighting(config: LightingConfig): LightingConfig {
  cache = config;
  save(FILE, cache, LightingConfigSchema);
  return cache;
}
