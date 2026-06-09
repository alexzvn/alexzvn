import { desktopCapturer } from 'electron';
import type { ScreenSourceInfo } from '@shared/types';

/** Aufnehmbare Monitore + Fenster inkl. Vorschaubild. */
export async function listScreens(): Promise<ScreenSourceInfo[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnailDataURL: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL(),
  }));
}
