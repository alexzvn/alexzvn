import path from 'node:path';
import { probeMedia } from '@jm/media';
import { newId, secToUs, type MediaAsset, type MediaKind } from '@shared/project';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff']);

/** Pfade proben und als Timeline-Assets aufbereiten (ohne Proxy-Erzeugung). */
export async function importPaths(paths: string[]): Promise<MediaAsset[]> {
  const out: MediaAsset[] = [];
  for (const p of paths) {
    try {
      out.push(await toAsset(p));
    } catch (err) {
      // Eine kaputte Datei darf den Rest des Imports nicht stoppen.
      console.error(`Import fehlgeschlagen: ${p}`, err);
    }
  }
  return out;
}

async function toAsset(filePath: string): Promise<MediaAsset> {
  const ext = path.extname(filePath).toLowerCase();
  const isImage = IMAGE_EXT.has(ext);
  const info = await probeMedia(filePath);

  const hasVideo = Boolean(info.video) && !isImage;
  const hasAudio = Boolean(info.audio);
  const kind: MediaKind = isImage ? 'image' : hasVideo ? 'video' : 'audio';

  // Bilder/dauerlose Quellen bekommen eine sinnvolle Standarddauer (5 s).
  const durationUs = info.durationSec > 0 ? secToUs(info.durationSec) : isImage ? secToUs(5) : 0;

  return {
    id: newId('asset'),
    path: filePath,
    fileName: info.fileName || path.basename(filePath),
    kind,
    durationUs,
    hasVideo,
    hasAudio,
    width: info.video?.width,
    height: info.video?.height,
    fps: info.video?.fps,
    probe: info,
    proxyState: 'none',
  };
}
