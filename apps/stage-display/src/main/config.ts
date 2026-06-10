import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONTROL_PORT } from '@jm/companion-protocol';
import type { PartialStageConfig, StageConfig } from '@shared/types';

const TIMER_DEFAULT_PORT = 7777;

const DEFAULT_CONFIG: StageConfig = {
  timer: { enabled: false, host: '127.0.0.1', port: TIMER_DEFAULT_PORT },
  switcher: { enabled: false, host: '127.0.0.1', port: DEFAULT_CONTROL_PORT },
  widgets: { clock: true, timer: true, switcher: true, message: true },
  message: '',
  outputDisplayId: null,
};

function configFile(): string {
  return join(app.getPath('userData'), 'stage-config.json');
}

let cache: StageConfig | null = null;

export function getConfig(): StageConfig {
  if (cache) return cache;
  try {
    if (existsSync(configFile())) {
      const data = JSON.parse(readFileSync(configFile(), 'utf8')) as Partial<StageConfig>;
      cache = {
        ...DEFAULT_CONFIG,
        ...data,
        timer: { ...DEFAULT_CONFIG.timer, ...data.timer },
        switcher: { ...DEFAULT_CONFIG.switcher, ...data.switcher },
        widgets: { ...DEFAULT_CONFIG.widgets, ...data.widgets },
      };
      return cache;
    }
  } catch {
    // korrupt → Defaults
  }
  cache = { ...DEFAULT_CONFIG };
  return cache;
}

/** Teil-Update mit verschachteltem Merge; persistiert und liefert den neuen Stand. */
export function patchConfig(patch: PartialStageConfig): StageConfig {
  const cur = getConfig();
  const next: StageConfig = {
    ...cur,
    ...(patch.message !== undefined ? { message: patch.message } : {}),
    ...(patch.outputDisplayId !== undefined ? { outputDisplayId: patch.outputDisplayId } : {}),
    timer: { ...cur.timer, ...patch.timer },
    switcher: { ...cur.switcher, ...patch.switcher },
    widgets: { ...cur.widgets, ...patch.widgets },
  };
  cache = next;
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(configFile(), JSON.stringify(next, null, 2));
  } catch {
    // nicht schreibbar → nur In-Memory
  }
  return next;
}
