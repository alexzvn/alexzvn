export interface ScreenSourceInfo {
  /** chromeMediaSourceId aus desktopCapturer.getSources(). */
  id: string;
  name: string;
  type: 'screen' | 'window';
  thumbnailDataURL: string;
}

export type NdiState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** Zustand des (einen) NDI-Empfängers, gespiegelt in den Renderer. */
export interface NdiStatus {
  state: NdiState;
  /** verbundener Quellname bzw. Fehlertext bei state === 'error'. */
  source: string | null;
}

/** Ein BGRA-Videoframe, das der utilityProcess → Main → Renderer-Port liefert. */
export interface NdiVideoMessage {
  type: 'video';
  /** BGRA, Länge = lineStride * height (Kopie — über Port strukturgeklont). */
  data: Uint8Array;
  width: number;
  height: number;
  lineStride: number;
  fpsN: number;
  fpsD: number;
}

/** NDI-Teil-API auf window.jmswitch — ein Empfänger gleichzeitig (Addon-Limit). */
export interface JmswitchNdiApi {
  /** Sichtbare NDI-Quellen im Netz suchen (Quellnamen). */
  find: (timeoutMs?: number) => Promise<string[]>;
  /** Mit einer Quelle verbinden (ersetzt einen bestehenden Empfänger). */
  connect: (source: string) => Promise<void>;
  /** Empfänger trennen. */
  disconnect: () => Promise<void>;
  /** Aktuellen Empfänger-Status abfragen. */
  getStatus: () => Promise<NdiStatus>;
  /** Auf Status-Änderungen hören. Gibt die Abmeldefunktion zurück. */
  onStatus: (cb: (s: NdiStatus) => void) => () => void;
}

/** Aufnahme-/Stream-Status des Program-Outputs (Slice 5). */
export interface OutputStatus {
  recording: boolean;
  streaming: boolean;
  recPath: string | null;
}

/** Fehler aus dem Output-Pfad (Datei-Schreibfehler, ffmpeg-Exit …). */
export interface OutputError {
  scope: 'record' | 'stream';
  message: string;
}

import type { ControlCommand, SwitcherStateMsg } from '@jm/companion-protocol';

/** Status des TCP-Steuerservers (Slice 6). */
export interface ControlStatus {
  running: boolean;
  port: number;
  clients: number;
}

/** TCP-Fernsteuerung (Bitfocus Companion). */
export interface JmswitchControlApi {
  start: (port: number) => Promise<{ ok: boolean; error?: string; port?: number }>;
  stop: () => Promise<void>;
  getStatus: () => Promise<ControlStatus>;
  onStatus: (cb: (s: ControlStatus) => void) => () => void;
  /** Eingehende Fernsteuer-Befehle (Renderer wendet sie an). */
  onCommand: (cb: (cmd: ControlCommand) => void) => () => void;
  /** Aktuellen Switcher-Zustand an den Server melden (→ Clients). */
  pushState: (state: SwitcherStateMsg) => void;
}

/** Aufnahme (WebM-Datei) + RTMP-Stream (ffmpeg) des Program-Outputs. */
export interface JmswitchOutputApi {
  /** Speicherort wählen + Datei öffnen. */
  recStart: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  /** Aufnahme ohne Dialog (Fernsteuerung): Standardordner + Zeitstempel. */
  recStartAuto: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  /** WebM-Chunk in die Aufnahmedatei schreiben. */
  recChunk: (chunk: Uint8Array) => void;
  /** Aufnahme abschließen. */
  recStop: () => void;
  /** ffmpeg → RTMP starten. `hasAudio` = WebM enthält eine echte Tonspur. */
  streamStart: (
    url: string,
    videoBitrateKbps?: number,
    hasAudio?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** WebM-Chunk in ffmpegs stdin schreiben. */
  streamChunk: (chunk: Uint8Array) => void;
  /** Stream beenden (ffmpeg stdin schließen). */
  streamStop: () => void;
  onStatus: (cb: (s: OutputStatus) => void) => () => void;
  onError: (cb: (e: OutputError) => void) => () => void;
}

/** Shape, die der Preload auf `window.jmswitch` legt. */
export interface JmswitchApi {
  platform: NodeJS.Platform;
  /** Aufnehmbare Monitore/Fenster auflisten (für die Bildschirm-Quelle). */
  listScreens: () => Promise<ScreenSourceInfo[]>;
  /** Quelle für das nächste getDisplayMedia() im Renderer vormerken. */
  armCapture: (sourceId: string) => Promise<void>;
  /** NDI-Empfang (Slice 3). */
  ndi: JmswitchNdiApi;
  /** Aufnahme + RTMP des Program-Outputs (Slice 5). */
  output: JmswitchOutputApi;
  /** TCP-Fernsteuerung / Companion (Slice 6). */
  control: JmswitchControlApi;
}
