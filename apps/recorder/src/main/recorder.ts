import type { BrowserWindow } from 'electron';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type * as AudioNS from '@jm/audio';
import type {
  ArmInput,
  AudioDevice,
  OpResult,
  RecordInput,
  RecordResult,
  RecorderState,
} from '@shared/types';
import { WavWriter } from './wav';

// Lazy-Load des nativen Addons: das Fenster startet auch ohne gebautes @jm/audio
// (z. B. im Codespace). Erst beim ersten Geräte-/Aufnahme-Zugriff geladen.
let audioMod: typeof AudioNS | null = null;
let inited = false;
function engine(): typeof AudioNS {
  if (!audioMod) {
    audioMod = require('@jm/audio') as typeof AudioNS;
  }
  if (!inited) {
    audioMod.init();
    inited = true;
  }
  return audioMod;
}

let getWin: () => BrowserWindow | null = () => null;
export function setWindowGetter(fn: () => BrowserWindow | null): void {
  getWin = fn;
}

const state: RecorderState = {
  status: 'idle',
  device: null,
  channels: 0,
  sampleRate: 0,
  filePath: null,
  recordedSec: 0,
};
let writer: WavWriter | null = null;
let peaks: number[] = [];
let lastEmit = 0;

function send(channel: string, payload: unknown): void {
  getWin()?.webContents.send(channel, payload);
}
function emitState(): void {
  send('recorder:state', { ...state });
}

export function getState(): RecorderState {
  return { ...state };
}

export function listDevices(): AudioDevice[] {
  return engine()
    .listDevices()
    .filter((d) => d.maxInputChannels > 0)
    .map((d) => ({
      index: d.index,
      name: d.name,
      hostApiName: d.hostApiName,
      maxInputChannels: d.maxInputChannels,
      defaultSampleRate: Math.round(d.defaultSampleRate),
    }));
}

// Läuft je Audioblock (TSFN → Node-Loop): Pegel sammeln, ggf. schreiben,
// gedrosselt Pegel/State an den Renderer senden.
function onFrames(planar: Float32Array, channels: number, frames: number): void {
  if (peaks.length !== channels) peaks = new Array(channels).fill(0);
  for (let c = 0; c < channels; c++) {
    let p = peaks[c];
    const base = c * frames;
    for (let i = 0; i < frames; i++) {
      const v = Math.abs(planar[base + i]);
      if (v > p) p = v;
    }
    peaks[c] = p;
  }

  if (state.status === 'recording' && writer) {
    writer.writeBlock(planar, channels, frames);
    state.recordedSec += frames / (state.sampleRate || 1);
  }

  const now = Date.now();
  if (now - lastEmit >= 50) {
    send('recorder:levels', { peaks: peaks.slice() });
    if (state.status === 'recording') emitState();
    peaks = new Array(channels).fill(0);
    lastEmit = now;
  }
}

export function arm(input: ArmInput): OpResult {
  try {
    if (state.status !== 'idle') disarm();
    engine().openInput(
      { device: input.device, channels: input.channels, sampleRate: input.sampleRate },
      onFrames,
    );
    state.status = 'armed';
    state.device = input.device;
    state.channels = input.channels;
    state.sampleRate = input.sampleRate;
    state.filePath = null;
    state.recordedSec = 0;
    peaks = new Array(input.channels).fill(0);
    emitState();
    return { ok: true };
  } catch (e) {
    state.status = 'idle';
    emitState();
    return { ok: false, error: (e as Error).message };
  }
}

export function disarm(): void {
  if (writer) {
    try {
      writer.finalize();
    } catch {
      // ignore
    }
    writer = null;
  }
  try {
    if (audioMod && inited) audioMod.stopInput();
  } catch {
    // ignore
  }
  state.status = 'idle';
  state.filePath = null;
  state.recordedSec = 0;
  emitState();
}

function defaultName(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `Aufnahme-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim() || defaultName();
}

export function startRecording(input: RecordInput): OpResult {
  if (state.status !== 'armed') return { ok: false, error: 'Erst den Eingang öffnen (Arm).' };
  try {
    mkdirSync(input.dir, { recursive: true });
    const base = input.fileName?.trim() ? sanitize(input.fileName) : defaultName();
    const filePath = path.join(input.dir, `${base}.wav`);
    writer = new WavWriter(filePath, state.channels, state.sampleRate);
    state.filePath = filePath;
    state.recordedSec = 0;
    state.status = 'recording';
    emitState();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function stopRecording(): RecordResult {
  if (state.status !== 'recording' || !writer) return { ok: false, error: 'Keine laufende Aufnahme.' };
  const filePath = state.filePath ?? '';
  try {
    const res = writer.finalize();
    writer = null;
    state.status = 'armed';
    emitState();
    return {
      ok: true,
      filePath,
      bytes: res.bytes,
      durationSec: res.durationSec,
      channels: state.channels,
      sampleRate: state.sampleRate,
    };
  } catch (e) {
    writer = null;
    state.status = 'armed';
    emitState();
    return { ok: false, error: (e as Error).message };
  }
}
