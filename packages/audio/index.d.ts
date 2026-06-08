/**
 * Natives Audio-Capture-Addon (PortAudio + ASIO-Host).
 * Spike-Stand — Build/Hardware-Test stehen noch aus (siehe README).
 */

export interface HostApiInfo {
  index: number;
  /** z. B. "ASIO", "Windows WASAPI", "MME", "Core Audio". */
  name: string;
  deviceCount: number;
  defaultInputDevice: number;
  defaultOutputDevice: number;
}

export interface DeviceInfo {
  index: number;
  /** z. B. "Dante Virtual Soundcard (x64)". */
  name: string;
  /** Index in listHostApis(). */
  hostApi: number;
  hostApiName: string;
  maxInputChannels: number;
  maxOutputChannels: number;
  defaultSampleRate: number;
  defaultLowInputLatencySec: number;
  defaultHighInputLatencySec: number;
}

export interface OpenInputOptions {
  /** Geräteindex aus listDevices(). */
  device: number;
  /** Anzahl Eingangskanäle (DVSC: bis zu 64, je nach Lizenz/Modus). */
  channels: number;
  sampleRate: number;
  /** Frames pro Callback-Block; 0 = von PortAudio/ASIO wählen lassen. */
  framesPerBuffer?: number;
}

/**
 * Callback je Audioblock. `planar` ist Float32 im planaren FLTP-Layout
 * [ch0:frames][ch1:frames]… — identisch zur NDI-FLTP-Konvention der Suite
 * ([[jm-ndi-screen-capture-tool]]). Der Buffer ist eine Kopie und nach Rückkehr
 * ungültig: sofort verarbeiten oder selbst kopieren.
 */
export type AudioFramesCallback = (
  planar: Float32Array,
  channels: number,
  frames: number,
) => void;

/** PortAudio initialisieren. Muss vor list*/openInput() laufen. */
export function init(): boolean;

/** Verfügbare Host-APIs (auf Windows ist "ASIO" der Eintrag für DVSC). */
export function listHostApis(): HostApiInfo[];

/** Alle Geräte aller Host-APIs. */
export function listDevices(): DeviceInfo[];

/**
 * Eingangsstream öffnen und starten. Ruft `onFrames` je Audioblock auf dem
 * Node-Loop auf (über eine ThreadSafeFunction marshalt vom Audio-Thread).
 * MVP: genau ein aktiver Input-Stream gleichzeitig.
 */
export function openInput(opts: OpenInputOptions, onFrames: AudioFramesCallback): void;

/** Aktiven Eingangsstream stoppen + schließen. */
export function stopInput(): void;

/** PortAudio herunterfahren. */
export function terminate(): void;
