import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { TimerSyncConfig } from '@shared/types';

// Timer-sync settings live in a small JSON file in userData — the operator points
// the presenter at the JM Timer once per machine and it survives restarts.
const FILE = (): string => path.join(app.getPath('userData'), 'timer-config.json');

export const DEFAULT_TIMER_CONFIG: TimerSyncConfig = {
  enabled: false,
  host: '127.0.0.1',
  port: 7777,
};

function coerce(raw: unknown): TimerSyncConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<TimerSyncConfig>;
  const port = Number(o.port);
  return {
    enabled: o.enabled === true,
    host: typeof o.host === 'string' && o.host.trim() ? o.host.trim() : DEFAULT_TIMER_CONFIG.host,
    port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_TIMER_CONFIG.port,
  };
}

export function loadTimerConfig(): TimerSyncConfig {
  try {
    return coerce(JSON.parse(readFileSync(FILE(), 'utf8')));
  } catch {
    return { ...DEFAULT_TIMER_CONFIG };
  }
}

export function saveTimerConfig(config: TimerSyncConfig): void {
  try {
    writeFileSync(FILE(), JSON.stringify(coerce(config), null, 2), 'utf8');
  } catch {
    // Non-fatal: the client still runs with the in-memory config this session.
  }
}
