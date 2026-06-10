import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG } from '@shared/types';
import type { PartialTranscribeConfig, TranscribeConfig, OutputFormat } from '@shared/types';

function configFile(): string {
  return join(app.getPath('userData'), 'transcribe-config.json');
}

let cache: TranscribeConfig | null = null;

export function getConfig(): TranscribeConfig {
  if (cache) return cache;
  try {
    if (existsSync(configFile())) {
      const data = JSON.parse(readFileSync(configFile(), 'utf8')) as Partial<TranscribeConfig>;
      cache = { ...DEFAULT_CONFIG, ...data };
      if (!Array.isArray(cache.formats) || cache.formats.length === 0) {
        cache.formats = [...DEFAULT_CONFIG.formats];
      }
      return cache;
    }
  } catch {
    // korrupt → Defaults
  }
  cache = { ...DEFAULT_CONFIG };
  return cache;
}

export function patchConfig(patch: PartialTranscribeConfig): TranscribeConfig {
  const cur = getConfig();
  const next: TranscribeConfig = {
    ...cur,
    ...(patch.model !== undefined ? { model: patch.model } : {}),
    ...(patch.language !== undefined ? { language: patch.language } : {}),
    ...(patch.task !== undefined ? { task: patch.task } : {}),
    ...(patch.formats !== undefined ? { formats: dedupeFormats(patch.formats) } : {}),
    ...(patch.outputDir !== undefined ? { outputDir: patch.outputDir } : {}),
  };
  cache = next;
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(configFile(), JSON.stringify(next, null, 2));
  } catch {
    // nur In-Memory
  }
  return next;
}

function dedupeFormats(formats: OutputFormat[]): OutputFormat[] {
  const order: OutputFormat[] = ['srt', 'vtt', 'txt'];
  const set = new Set(formats);
  const out = order.filter((f) => set.has(f));
  return out.length ? out : ['srt'];
}
