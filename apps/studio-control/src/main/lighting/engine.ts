import dgram from 'node:dgram';
import { getLighting, saveLighting } from '../config/lighting';
import {
  ARTNET_PORT,
  DEFAULT_ARTNET_FPS,
  DMX_UNIVERSE_SIZE,
  renderFixture,
  type ArtnetNode,
  type Fixture,
  type FixtureStatePatch,
  type LightingConfig,
} from '@shared/lighting';

// The engine owns the runtime lighting state: it composes each fixture into its
// universe buffer, streams Art-Net DMX to the configured node at a steady rate
// (continuous output is what real lighting consoles do — also keeps nodes that
// time out alive), and persists the config. Structural changes notify listeners
// so the server can rebroadcast; per-frame fader moves do not (they would flood
// every client) and are persisted debounced.

const SAVE_DEBOUNCE_MS = 1500;

let socket: dgram.Socket | null = null;
let node: ArtnetNode | null = null;
let fixtures: Fixture[] = [];
let blackout = false;

const universes = new Map<number, Uint8Array>();
const sequence = new Map<number, number>();
let sendTimer: NodeJS.Timeout | null = null;
let saveTimer: NodeJS.Timeout | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function onLightingChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getLightingState(): { config: LightingConfig; blackout: boolean } {
  return { config: { node, fixtures }, blackout };
}

export function isBlackout(): boolean {
  return blackout;
}

/** Rebuild every universe buffer from the current fixtures + blackout flag. */
function recompute(): void {
  universes.clear();
  for (const fx of fixtures) {
    const values = blackout ? [] : renderFixture(fx.profileId, fx.state);
    let buf = universes.get(fx.universe);
    if (!buf) {
      buf = new Uint8Array(DMX_UNIVERSE_SIZE);
      universes.set(fx.universe, buf);
    }
    const start = fx.address - 1; // address is 1-based
    for (let i = 0; i < values.length; i++) {
      const ch = start + i;
      if (ch >= 0 && ch < DMX_UNIVERSE_SIZE) buf[ch] = values[i]! & 0xff;
    }
  }
}

function buildArtDmx(universe: number, data: Uint8Array, seq: number): Buffer {
  const len = DMX_UNIVERSE_SIZE;
  const buf = Buffer.alloc(18 + len);
  buf.write('Art-Net\0', 0, 'ascii');
  buf.writeUInt16LE(0x5000, 8); // OpDmx
  buf.writeUInt16BE(14, 10); // protVer
  buf.writeUInt8(seq & 0xff, 12); // sequence
  buf.writeUInt8(0, 13); // physical
  buf.writeUInt8(universe & 0xff, 14); // SubUni (low byte of port address)
  buf.writeUInt8((universe >> 8) & 0x7f, 15); // Net (high 7 bits)
  buf.writeUInt16BE(len, 16); // length
  Buffer.from(data.buffer, data.byteOffset, data.byteLength).copy(buf, 18);
  return buf;
}

function tick(): void {
  if (!socket || !node) return;
  for (const [universe, data] of universes) {
    const seq = ((sequence.get(universe) ?? 0) % 255) + 1;
    sequence.set(universe, seq);
    const pkt = buildArtDmx(universe, data, seq);
    socket.send(pkt, ARTNET_PORT, node.host, () => {
      /* UDP fire-and-forget */
    });
  }
}

function restartLoop(): void {
  if (sendTimer) {
    clearInterval(sendTimer);
    sendTimer = null;
  }
  if (!node) return;
  const fps = node.fps ?? DEFAULT_ARTNET_FPS;
  sendTimer = setInterval(tick, Math.max(1, Math.round(1000 / fps)));
}

function ensureSocket(): void {
  if (!socket) {
    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('error', () => {
      /* ignore — UDP output, next tick retries */
    });
  }
}

function persist(): void {
  saveLighting({ node, fixtures });
}

function persistDebounced(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, SAVE_DEBOUNCE_MS);
}

export function initLighting(): void {
  const cfg = getLighting();
  node = cfg.node;
  fixtures = cfg.fixtures;
  blackout = false;
  if (node) ensureSocket();
  recompute();
  restartLoop();
}

export function setNode(next: ArtnetNode | null): void {
  node = next;
  if (node) ensureSocket();
  restartLoop();
  persist();
  notify();
}

export function upsertFixture(fx: Fixture): void {
  const idx = fixtures.findIndex((f) => f.id === fx.id);
  if (idx >= 0) fixtures = [...fixtures.slice(0, idx), fx, ...fixtures.slice(idx + 1)];
  else fixtures = [...fixtures, fx];
  recompute();
  persist();
  notify();
}

export function removeFixture(id: string): void {
  fixtures = fixtures.filter((f) => f.id !== id);
  recompute();
  persist();
  notify();
}

/** Live fader / colour update — applied + output immediately, saved debounced,
 *  NOT broadcast (would flood clients at frame rate). */
export function setFixtureState(id: string, patch: FixtureStatePatch): boolean {
  const idx = fixtures.findIndex((f) => f.id === id);
  if (idx < 0) return false;
  const fx = fixtures[idx]!;
  const next: Fixture = { ...fx, state: { ...fx.state, ...patch } };
  fixtures = [...fixtures.slice(0, idx), next, ...fixtures.slice(idx + 1)];
  recompute();
  persistDebounced();
  return true;
}

export function setBlackout(on: boolean): void {
  blackout = on;
  recompute();
  notify();
}

export function stopLighting(): void {
  if (sendTimer) clearInterval(sendTimer);
  if (saveTimer) {
    clearTimeout(saveTimer);
    persist();
  }
  sendTimer = null;
  saveTimer = null;
  try {
    socket?.close();
  } catch {
    /* ignore */
  }
  socket = null;
}
