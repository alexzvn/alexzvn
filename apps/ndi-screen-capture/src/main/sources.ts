import { desktopCapturer } from 'electron';
import type { JmNdiSource } from '@shared/types';

/**
 * Listet aufnehmbare Quellen (Monitore + Fenster) inkl. Vorschaubild und – bei
 * Fenstern – App-Icon. Die `id` ist die chromeMediaSourceId, die der
 * DisplayMedia-Handler (capture-handler.ts) zum Auflösen der Auswahl nutzt.
 */
export async function listSources(): Promise<JmNdiSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnailDataURL: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL(),
    appIconDataURL: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : undefined,
  }));
}
