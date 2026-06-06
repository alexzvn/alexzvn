import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RemoteConfig } from '@shared/types';

// Remote settings live in a small JSON file in userData — they must survive
// restarts (the operator sets up the clicker once per machine).
const FILE = (): string => path.join(app.getPath('userData'), 'remote-config.json');

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  enabled: false,
  bind: 'all',
  port: 7330,
  pinEnabled: true,
};

function coerce(raw: unknown): RemoteConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<RemoteConfig>;
  const port = Number(o.port);
  return {
    enabled: o.enabled === true,
    bind: typeof o.bind === 'string' && o.bind ? o.bind : DEFAULT_REMOTE_CONFIG.bind,
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_REMOTE_CONFIG.port,
    pinEnabled: o.pinEnabled !== false,
  };
}

export function loadRemoteConfig(): RemoteConfig {
  try {
    return coerce(JSON.parse(readFileSync(FILE(), 'utf8')));
  } catch {
    return { ...DEFAULT_REMOTE_CONFIG };
  }
}

export function saveRemoteConfig(config: RemoteConfig): void {
  try {
    writeFileSync(FILE(), JSON.stringify(config, null, 2), 'utf8');
  } catch {
    // Non-fatal: the server still runs with the in-memory config this session.
  }
}
