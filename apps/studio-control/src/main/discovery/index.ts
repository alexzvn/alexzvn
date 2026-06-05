import type { DiscoveredDevice } from '@shared/device';
import { mdnsProvider } from './mdns';
import { artpollProvider } from './artpoll';
import { panasonicProvider } from './panasonic';
import type { DiscoveryProvider } from './types';

const PROVIDERS: DiscoveryProvider[] = [
  mdnsProvider,
  artpollProvider,
  panasonicProvider,
];

const DEFAULT_TIMEOUT_MS = 4000;

interface RunResult {
  results: DiscoveredDevice[];
  durationMs: number;
}

let scanning = false;

export function isScanning(): boolean {
  return scanning;
}

export async function runAll(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  onProviderResult?: (results: DiscoveredDevice[]) => void,
): Promise<RunResult> {
  if (scanning) {
    return { results: [], durationMs: 0 };
  }
  scanning = true;
  const start = Date.now();

  const all = new Map<string, DiscoveredDevice>();
  const tasks = PROVIDERS.map(async (p) => {
    try {
      const list = await p.scan(timeoutMs);
      for (const d of list) {
        const key = d.mac ?? `${d.protocol}:${d.ip}`;
        if (!all.has(key)) all.set(key, d);
      }
      if (onProviderResult) onProviderResult(list);
    } catch (err) {
      console.warn(`[jm-studio-control] discovery ${p.name} failed`, err);
    }
  });

  try {
    await Promise.all(tasks);
    return { results: [...all.values()], durationMs: Date.now() - start };
  } finally {
    scanning = false;
  }
}
