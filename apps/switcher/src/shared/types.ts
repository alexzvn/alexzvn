export interface ScreenSourceInfo {
  /** chromeMediaSourceId aus desktopCapturer.getSources(). */
  id: string;
  name: string;
  type: 'screen' | 'window';
  thumbnailDataURL: string;
}

/** Shape, die der Preload auf `window.jmswitch` legt. */
export interface JmswitchApi {
  platform: NodeJS.Platform;
  /** Aufnehmbare Monitore/Fenster auflisten (für die Bildschirm-Quelle). */
  listScreens: () => Promise<ScreenSourceInfo[]>;
  /** Quelle für das nächste getDisplayMedia() im Renderer vormerken. */
  armCapture: (sourceId: string) => Promise<void>;
}
