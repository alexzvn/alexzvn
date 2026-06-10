import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, DEFAULT_COLORS } from '@shared/types';
import type { PartialPrompterConfig, PrompterConfig } from '@shared/types';

function configFile(): string {
  return join(app.getPath('userData'), 'prompter-config.json');
}

let cache: PrompterConfig | null = null;

export function getConfig(): PrompterConfig {
  if (cache) return cache;
  try {
    if (existsSync(configFile())) {
      const data = JSON.parse(readFileSync(configFile(), 'utf8')) as Partial<PrompterConfig>;
      cache = {
        ...DEFAULT_CONFIG,
        ...data,
        colors: { ...DEFAULT_COLORS, ...data.colors },
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
export function patchConfig(patch: PartialPrompterConfig): PrompterConfig {
  const cur = getConfig();
  const next: PrompterConfig = {
    ...cur,
    ...(patch.script !== undefined ? { script: patch.script } : {}),
    ...(patch.fontScale !== undefined ? { fontScale: patch.fontScale } : {}),
    ...(patch.lineHeight !== undefined ? { lineHeight: patch.lineHeight } : {}),
    ...(patch.speed !== undefined ? { speed: patch.speed } : {}),
    ...(patch.mirrorH !== undefined ? { mirrorH: patch.mirrorH } : {}),
    ...(patch.mirrorV !== undefined ? { mirrorV: patch.mirrorV } : {}),
    ...(patch.marginXPct !== undefined ? { marginXPct: patch.marginXPct } : {}),
    ...(patch.readingLine !== undefined ? { readingLine: patch.readingLine } : {}),
    ...(patch.readingLinePct !== undefined ? { readingLinePct: patch.readingLinePct } : {}),
    ...(patch.bold !== undefined ? { bold: patch.bold } : {}),
    ...(patch.outputDisplayId !== undefined ? { outputDisplayId: patch.outputDisplayId } : {}),
    colors: { ...cur.colors, ...patch.colors },
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
