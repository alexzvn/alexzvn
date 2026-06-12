import { load, save } from './store';
import {
  AudioConsoleConfigListSchema,
  type AudioConsoleConfig,
  type AudioConsoleConfigList,
} from '@shared/audio';

const FILE = 'audio.json';
const SAVE_DEBOUNCE_MS = 1500;
let cache: AudioConsoleConfigList = [];
let saveTimer: NodeJS.Timeout | null = null;

export function loadAudioConsoles(): AudioConsoleConfigList {
  cache = load(FILE, AudioConsoleConfigListSchema, []);
  return cache;
}

export function getAudioConsoles(): AudioConsoleConfigList {
  return cache;
}

function persist(): void {
  save(FILE, cache, AudioConsoleConfigListSchema);
}

function persistDebounced(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, SAVE_DEBOUNCE_MS);
}

export function upsertAudioConsole(cfg: AudioConsoleConfig): AudioConsoleConfigList {
  const idx = cache.findIndex((c) => c.id === cfg.id);
  if (idx >= 0) cache = [...cache.slice(0, idx), cfg, ...cache.slice(idx + 1)];
  else cache = [...cache, cfg];
  persist();
  return cache;
}

export function removeAudioConsole(id: string): AudioConsoleConfigList {
  cache = cache.filter((c) => c.id !== id);
  persist();
  return cache;
}

/**
 * Record the last-set value of a channel (this tool is a control surface; the
 * desk holds the authoritative mix). Saved debounced — fader moves are frequent.
 */
export function updateChannelState(
  consoleId: string,
  ch: number,
  patch: { db?: number; mute?: boolean },
): boolean {
  const idx = cache.findIndex((c) => c.id === consoleId);
  if (idx < 0) return false;
  const con = cache[idx]!;
  const chans = con.channels.filter((c) => c.ch !== ch);
  const prev = con.channels.find((c) => c.ch === ch);
  chans.push({ ch, db: patch.db ?? prev?.db ?? 0, mute: patch.mute ?? prev?.mute ?? false });
  chans.sort((a, b) => a.ch - b.ch);
  cache = [...cache.slice(0, idx), { ...con, channels: chans }, ...cache.slice(idx + 1)];
  persistDebounced();
  return true;
}
