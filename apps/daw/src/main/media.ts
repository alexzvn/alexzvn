import { app } from 'electron';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ffmpegPath, probeMedia, spawnFfmpeg } from '@jm/media';
import { DEFAULT_SAMPLE_RATE, newId, secToUs, type MediaAsset } from '@shared/project';
import type { TranscodeResult } from '@shared/ipc-types';

// Container/Codecs, die Chromiums decodeAudioData direkt frisst (kein Transkodieren).
const WEB_DECODABLE = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.weba']);

/** Pfade proben und als Audio-Assets aufbereiten. */
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
  const info = await probeMedia(filePath);
  const durationUs = info.durationSec > 0 ? secToUs(info.durationSec) : 0;

  return {
    id: newId('asset'),
    path: filePath,
    fileName: info.fileName || path.basename(filePath),
    durationUs,
    sampleRate: info.audio?.sampleRate,
    channels: info.audio?.channels,
    hasAudio: Boolean(info.audio),
    probe: info,
    needsTranscode: !WEB_DECODABLE.has(ext),
    proxyState: 'none',
  };
}

function cacheDir(): string {
  const dir = path.join(app.getPath('userData'), 'decode-cache');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Stabiler Cache-Schlüssel aus Pfad + Größe + mtime. */
function cacheKey(filePath: string): string {
  const st = statSync(filePath);
  return createHash('sha1').update(`${filePath}:${st.size}:${st.mtimeMs}`).digest('hex').slice(0, 16);
}

/**
 * Exotische Quelle nach 48-kHz-Stereo-Float-WAV transkodieren, damit der Renderer
 * sie via decodeAudioData laden kann. Ergebnis wird gecacht (idempotent).
 * Muster wie der Proxy-Pfad im JM Editor.
 */
export async function transcodeForDecode(asset: MediaAsset): Promise<TranscodeResult> {
  try {
    if (!existsSync(asset.path)) return { ok: false, error: 'Quelldatei fehlt.' };
    const out = path.join(cacheDir(), `${cacheKey(asset.path)}.wav`);
    if (existsSync(out)) return { ok: true, proxyPath: out };

    const args = [
      '-y',
      '-i', asset.path,
      '-vn',
      '-ac', '2',
      '-ar', String(DEFAULT_SAMPLE_RATE),
      '-c:a', 'pcm_f32le',
      out,
    ];
    let stderrTail = '';
    const { code } = await spawnFfmpeg(args, {
      ffmpeg: ffmpegPath(),
      onStderr: (s) => {
        stderrTail += s;
        if (stderrTail.length > 8000) stderrTail = stderrTail.slice(-8000);
      },
    });
    if (code === 0 && existsSync(out)) return { ok: true, proxyPath: out };
    const detail = stderrTail.trim().split('\n').slice(-2).join(' ').trim();
    return { ok: false, error: detail || `ffmpeg endete mit Code ${code}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
