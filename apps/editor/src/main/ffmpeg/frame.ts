import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ffmpegPath } from '@jm/media';
import type { ThumbRequest, ThumbResult } from '@shared/ipc-types';

const execFileAsync = promisify(execFile);
const OPTS = { maxBuffer: 8 * 1024 * 1024, windowsHide: true } as const;

/** Anzeigebreite kappen, damit Data-URLs klein bleiben. */
const DISPLAY_CAP = 480;

function dataUrl(file: string): string {
  return existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString('base64')}` : '';
}

/**
 * Greift EIN Bild an `atSec` ab (kein Encode) — für Timeline-Thumbnails und als
 * Vorschau-Fallback für Codecs, die `<video>` nicht dekodieren kann. Übernimmt
 * das Muster aus JM Media Converter (preview.ts grabFrame).
 */
export async function grabFrame(req: ThumbRequest): Promise<ThumbResult> {
  const vf = [`scale=-2:${req.height}:flags=fast_bilinear`, `scale='min(${DISPLAY_CAP},iw)':-2`].join(',');
  const tmp = mkdtempSync(path.join(tmpdir(), 'jmed-frame-'));
  const png = path.join(tmp, 'f.png');
  try {
    await execFileAsync(
      ffmpegPath(),
      ['-y', '-ss', String(Math.max(0, req.atSec)), '-i', req.path, '-frames:v', '1', '-vf', vf, '-loglevel', 'error', png],
      OPTS,
    );
    return { dataUrl: dataUrl(png) };
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
  }
}
