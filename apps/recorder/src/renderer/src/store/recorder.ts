import { create } from 'zustand';
import type { AudioDevice, RecorderState } from '@shared/types';

const IDLE: RecorderState = {
  status: 'idle',
  device: null,
  channels: 0,
  sampleRate: 0,
  filePath: null,
  recordedSec: 0,
};

interface RecStore {
  devices: AudioDevice[];
  deviceIndex: number | null;
  channels: number;
  sampleRate: number;
  dir: string | null;
  fileName: string;
  state: RecorderState;
  peaks: number[];
  notice: string | null;
  loading: boolean;

  init: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectDevice: (index: number) => void;
  setChannels: (n: number) => void;
  setSampleRate: (n: number) => void;
  setFileName: (s: string) => void;
  pickDir: () => Promise<void>;
  arm: () => Promise<void>;
  disarm: () => Promise<void>;
  record: () => Promise<void>;
  stop: () => Promise<void>;
  setNotice: (s: string | null) => void;
}

let subscribed = false;

export const useRec = create<RecStore>((set, get) => ({
  devices: [],
  deviceIndex: null,
  channels: 2,
  sampleRate: 48000,
  dir: null,
  fileName: '',
  state: IDLE,
  peaks: [],
  notice: null,
  loading: true,

  setNotice: (notice) => set({ notice }),

  init: async () => {
    if (!subscribed) {
      subscribed = true;
      window.jmrec.onLevels((l) => set({ peaks: l.peaks }));
      window.jmrec.onState((s) => set({ state: s }));
    }
    await get().refreshDevices();
    set({ loading: false });
  },

  refreshDevices: async () => {
    try {
      const devices = await window.jmrec.listDevices();
      set({ devices });
      // Vorauswahl: bevorzugt ein ASIO-/Dante-Gerät, sonst das erste.
      if (get().deviceIndex == null && devices.length) {
        const preferred =
          devices.find((d) => /dante/i.test(d.name)) ??
          devices.find((d) => /asio/i.test(d.hostApiName)) ??
          devices[0];
        get().selectDevice(preferred.index);
      }
    } catch (e) {
      set({ notice: (e as Error).message });
    }
  },

  selectDevice: (index) => {
    const d = get().devices.find((x) => x.index === index);
    if (!d) return;
    set({
      deviceIndex: index,
      channels: Math.min(d.maxInputChannels, 2) || 1,
      sampleRate: d.defaultSampleRate || 48000,
    });
  },
  setChannels: (n) => set({ channels: Math.max(1, Math.floor(n) || 1) }),
  setSampleRate: (n) => set({ sampleRate: Math.max(8000, Math.floor(n) || 48000) }),
  setFileName: (fileName) => set({ fileName }),

  pickDir: async () => {
    const dir = await window.jmrec.dialog.pickDir();
    if (dir) set({ dir });
  },

  arm: async () => {
    const { deviceIndex, channels, sampleRate } = get();
    if (deviceIndex == null) {
      set({ notice: 'Kein Eingang gewählt.' });
      return;
    }
    const res = await window.jmrec.arm({ device: deviceIndex, channels, sampleRate });
    if (!res.ok) set({ notice: res.error ?? 'Eingang konnte nicht geöffnet werden.' });
  },

  disarm: async () => {
    await window.jmrec.disarm();
    set({ peaks: [] });
  },

  record: async () => {
    let dir = get().dir;
    if (!dir) {
      await get().pickDir();
      dir = get().dir;
      if (!dir) return;
    }
    const res = await window.jmrec.startRecording({ dir, fileName: get().fileName });
    if (!res.ok) set({ notice: res.error ?? 'Aufnahme konnte nicht gestartet werden.' });
  },

  stop: async () => {
    const res = await window.jmrec.stopRecording();
    if (res.ok && res.filePath) {
      set({ notice: `Gespeichert: ${res.filePath}` });
    } else if (!res.ok) {
      set({ notice: res.error ?? 'Stopp fehlgeschlagen.' });
    }
  },
}));
