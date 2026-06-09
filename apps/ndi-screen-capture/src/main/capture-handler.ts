import { desktopCapturer, session } from 'electron';
import type { JmNdiStartOptions } from '@shared/types';

// Die zuletzt per armCapture() gewählte Quelle. getDisplayMedia() im Renderer
// löst den unten registrierten Handler aus, der genau diese Quelle liefert –
// ohne System-Picker-Dialog.
let pending: { sourceId: string; audio: boolean } | null = null;

export function armCapture(opts: JmNdiStartOptions): void {
  pending = { sourceId: opts.sourceId, audio: opts.audio };
}

export function disarmCapture(): void {
  pending = null;
}

/**
 * Einmalig beim App-Start registrieren. Beantwortet getDisplayMedia()-Anfragen
 * mit der vorab gewählten Quelle. System-Audio per Loopback nur unter Windows
 * (Electron `audio: 'loopback'`); auf anderen Plattformen video-only.
 */
export function installDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    if (!pending) {
      callback({});
      return;
    }
    const want = pending;
    desktopCapturer
      .getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        const source = sources.find((s) => s.id === want.sourceId) ?? sources[0];
        if (!source) {
          callback({});
          return;
        }
        const loopback = want.audio && process.platform === 'win32';
        callback({ video: source, audio: loopback ? 'loopback' : undefined });
      })
      .catch(() => callback({}));
  });
}
