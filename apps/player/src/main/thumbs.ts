import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnFfmpeg } from '@jm/media';
import { getItem, setThumb } from './library';

function thumbDir(): string {
  const dir = path.join(app.getPath('userData'), 'thumbs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Erzeugt (falls nötig) ein Thumbnail für ein Video und liefert den Pfad.
 * Best-effort: bei fehlendem ffmpeg / Fehler / Audio → null (kein Crash).
 * Audio-Waveforms kommen in v0.2.
 */
export async function ensureThumb(id: number): Promise<string | null> {
  const item = getItem(id);
  if (!item) return null;
  if (item.thumbPath && existsSync(item.thumbPath)) return item.thumbPath;
  if (item.kind !== 'video') return null;

  const out = path.join(thumbDir(), `${id}.jpg`);
  const at = item.durationSec > 0 ? Math.min(item.durationSec / 2, 3) : 0;
  try {
    const { code } = await spawnFfmpeg([
      '-y', '-ss', String(at), '-i', item.path,
      '-frames:v', '1', '-vf', 'scale=-2:240', '-loglevel', 'error', out,
    ]);
    if (code === 0 && existsSync(out)) {
      setThumb(id, out);
      return out;
    }
  } catch {
    // ffmpeg nicht vorhanden / Fehler → kein Thumb
  }
  return null;
}
