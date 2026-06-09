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

/** Shape, die der Preload auf `window.jmswitch` legt. */
export interface JmswitchApi {
  platform: NodeJS.Platform;
  /** Aufnehmbare Monitore/Fenster auflisten (für die Bildschirm-Quelle). */
  listScreens: () => Promise<ScreenSourceInfo[]>;
  /** Quelle für das nächste getDisplayMedia() im Renderer vormerken. */
  armCapture: (sourceId: string) => Promise<void>;
  /** NDI-Empfang (Slice 3). */
  ndi: JmswitchNdiApi;
}
