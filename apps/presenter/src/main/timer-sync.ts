import type { TimerSource, TimerSyncConfig } from '@shared/types';
import { TimerClient, TIMER_OFFLINE } from './timer-client';
import { DEFAULT_TIMER_CONFIG } from './timer-config';

// Owns the single TimerClient and the latest mirrored state. ipc.ts registers a
// handler that broadcasts every change to the windows; the renderer ticks the
// raw countdown locally so the readout stays smooth between pushes.

let config: TimerSyncConfig = { ...DEFAULT_TIMER_CONFIG };
let lastState: TimerSource = { ...TIMER_OFFLINE };
let onStateChange: ((s: TimerSource) => void) | null = null;

const client = new TimerClient((s) => {
  lastState = s;
  onStateChange?.(s);
});

/** Register a callback fired whenever the live timer state changes (ipc → windows). */
export function setTimerStateHandler(cb: (s: TimerSource) => void): void {
  onStateChange = cb;
}

export function getTimerState(): TimerSource {
  return lastState;
}

export function getTimerConfig(): TimerSyncConfig {
  return config;
}

// Reconnect only when host/port/enabled actually change — repeated applies
// (e.g. a UI re-render) must not tear down a healthy connection.
let appliedKey = '';
export function applyTimerConfig(cfg: TimerSyncConfig): TimerSyncConfig {
  config = cfg;
  const key = cfg.enabled ? `${cfg.host}:${cfg.port}` : '';
  if (key !== appliedKey) {
    appliedKey = key;
    if (key) client.connect(cfg.host, cfg.port);
    else client.disconnect();
  }
  return config;
}

/** Stop the client (called on app quit). */
export function shutdownTimer(): void {
  appliedKey = '';
  client.disconnect();
}
