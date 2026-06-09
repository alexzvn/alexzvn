export interface AudioDevice {
  index: number;
  name: string;
  hostApiName: string;
  maxInputChannels: number;
  defaultSampleRate: number;
}

export type RecorderStatus = 'idle' | 'armed' | 'recording';

export interface RecorderState {
  status: RecorderStatus;
  device: number | null;
  channels: number;
  sampleRate: number;
  filePath: string | null;
  recordedSec: number;
}

export interface ArmInput {
  device: number;
  channels: number;
  sampleRate: number;
}

export interface RecordInput {
  dir: string;
  /** Basisname ohne Endung; Standard = Zeitstempel. */
  fileName?: string;
}

export interface OpResult {
  ok: boolean;
  error?: string;
}

export interface RecordResult extends OpResult {
  filePath?: string;
  bytes?: number;
  durationSec?: number;
  channels?: number;
  sampleRate?: number;
}

/** Spitzenpegel pro Kanal, linear 0..1 (der Renderer rechnet in dBFS um). */
export interface Levels {
  peaks: number[];
}

/** Shape, die der Preload auf `window.jmrec` legt. */
export interface JmrecApi {
  platform: NodeJS.Platform;
  listDevices: () => Promise<AudioDevice[]>;
  /** Eingang öffnen (Pegel laufen, noch keine Datei). */
  arm: (input: ArmInput) => Promise<OpResult>;
  /** Eingang schließen. */
  disarm: () => Promise<void>;
  /** Aufnahme in WAV starten (muss armed sein). */
  startRecording: (input: RecordInput) => Promise<OpResult>;
  /** Aufnahme beenden + WAV finalisieren. */
  stopRecording: () => Promise<RecordResult>;
  getState: () => Promise<RecorderState>;
  dialog: { pickDir: () => Promise<string | null> };
  shell: { reveal: (path: string) => Promise<void> };
  onLevels: (cb: (l: Levels) => void) => () => void;
  onState: (cb: (s: RecorderState) => void) => () => void;
}
