// Instant-Replay-Clip: schneidet die letzten N Sekunden aus einer Aufnahmedatei
// mit FFmpeg (@jm/media, ffmpeg-static). Stream-Copy (kein Re-Encode) → schnell;
// Ausgabe im selben Container wie die Quelle. -ss vor -i = schneller Input-Seek.
import { probeMedia, spawnFfmpeg } from '@jm/media';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

export interface ClipRequest {
  recordingPath: string;
  clipDir: string;
  seconds: number;
  /** Basisname ohne Endung (Endung wird aus der Quelle übernommen). */
  outBase: string;
}

export interface ClipOutcome {
  ok: boolean;
  outputPath: string;
  error?: string;
}

export async function makeClip(req: ClipRequest): Promise<ClipOutcome> {
  const ext = extname(req.recordingPath) || '.mp4';
  const outputPath = join(req.clipDir, `${req.outBase}${ext}`);

  if (!req.recordingPath || !existsSync(req.recordingPath)) {
    return { ok: false, outputPath, error: 'Aufnahmedatei nicht gefunden — bitte eine Quelle wählen.' };
  }

  let start = 0;
  try {
    const info = await probeMedia(req.recordingPath);
    start = Math.max(0, info.durationSec - Math.max(1, req.seconds));
  } catch {
    start = 0; // ohne Probe lieber von vorn als Abbruch
  }

  const args = [
    '-y',
    '-ss', String(start),
    '-i', req.recordingPath,
    '-t', String(Math.max(1, req.seconds)),
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    '-progress', 'pipe:1',
    '-nostats',
    '-loglevel', 'error',
    outputPath,
  ];

  try {
    const res = await spawnFfmpeg(args);
    if (res.code === 0) return { ok: true, outputPath };
    const detail = res.stderr.trim().split('\n').slice(-2).join(' ').trim();
    return { ok: false, outputPath, error: detail || `ffmpeg endete mit Code ${res.code}` };
  } catch (err) {
    return { ok: false, outputPath, error: (err as Error).message };
  }
}
