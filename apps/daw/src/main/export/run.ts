import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ffmpegPath, spawnFfmpeg } from '@jm/media';
import { newId } from '@shared/project';
import type { ExportProgress, ExportResult, ExportRunRequest } from '@shared/ipc-types';

export interface ExportEmitter {
  progress: (p: ExportProgress) => void;
  done: (r: ExportResult) => void;
}

let emitter: ExportEmitter | null = null;
export function setExportEmitter(e: ExportEmitter): void {
  emitter = e;
}

interface ActiveExport {
  abort: AbortController;
  tmpDir: string;
  outputPath: string;
}
const active = new Map<string, ActiveExport>();

export function cancelExport(exportId: string): void {
  active.get(exportId)?.abort.abort();
}

/** Startet einen Export-Job; das Ergebnis kommt über die Emitter-Events. */
export async function startExport(req: ExportRunRequest): Promise<{ exportId: string }> {
  const exportId = newId('exp');
  void run(exportId, req);
  return { exportId };
}

/** Sekundenlänge aus einem 32-bit-Float-WAV (für die Fortschrittsberechnung). */
function wavDurationSec(wav: Uint8Array): number {
  if (wav.length < 44) return 0;
  const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const channels = dv.getUint16(22, true) || 2;
  const sampleRate = dv.getUint32(24, true) || 48_000;
  const dataBytes = dv.getUint32(40, true) || wav.length - 44;
  const frames = dataBytes / (channels * 4);
  return sampleRate ? frames / sampleRate : 0;
}

/** FFmpeg-Codec-Argumente je Zielformat. */
function encodeArgs(req: ExportRunRequest): string[] {
  const br = req.bitrateKbps && req.bitrateKbps > 0 ? `${req.bitrateKbps}k` : '256k';
  switch (req.format) {
    case 'mp3':
      return ['-c:a', 'libmp3lame', '-b:a', br];
    case 'flac':
      return ['-c:a', 'flac'];
    case 'aac':
      return ['-c:a', 'aac', '-b:a', br];
    case 'ogg':
      return ['-c:a', 'libvorbis', '-b:a', br];
    case 'wav':
    default:
      // WAV mit gewünschter Bittiefe (Float-Quelle → PCM/Float).
      // bitDepth wird über sampleFmt unten gewählt.
      return ['-c:a', 'pcm_f32le'];
  }
}

/** Ob die Float-WAV-Bytes ohne Re-Encode direkt geschrieben werden können. */
function isPassthrough(req: ExportRunRequest, bitDepth: number): boolean {
  return req.format === 'wav' && bitDepth === 32;
}

async function run(exportId: string, req: ExportRunRequest): Promise<void> {
  const { outputPath } = req;
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'jmdaw-export-'));
  const abort = new AbortController();
  active.set(exportId, { abort, tmpDir, outputPath });

  // bitDepth nur für WAV relevant; default 32 (Passthrough) wenn nicht gesetzt.
  const bitDepth = req.format === 'wav' ? req.bitDepth ?? 32 : 32;

  try {
    // Der Renderer liefert immer ein 32-bit-Float-WAV.
    const srcWav = path.join(tmpDir, 'mix.wav');
    writeFileSync(srcWav, req.wav);

    if (isPassthrough(req, bitDepth)) {
      copyFileSync(srcWav, outputPath);
      emitter?.progress({ exportId, percent: 100 });
      emitter?.done({ exportId, success: true, outputPath });
      return;
    }

    const codec = encodeArgs(req);
    // WAV-Bittiefe via Sample-Format steuern (16/24-bit PCM).
    const sampleFmt =
      req.format === 'wav' && bitDepth === 16
        ? ['-c:a', 'pcm_s16le']
        : req.format === 'wav' && bitDepth === 24
          ? ['-c:a', 'pcm_s24le']
          : codec;

    const totalSec = wavDurationSec(req.wav);
    const args = [
      '-y',
      '-i', srcWav,
      ...sampleFmt,
      '-progress', 'pipe:1',
      '-nostats',
      outputPath,
    ];

    let stderrTail = '';
    const { code } = await spawnFfmpeg(args, {
      signal: abort.signal,
      ffmpeg: ffmpegPath(),
      onStderr: (s) => {
        stderrTail += s;
        if (stderrTail.length > 12000) stderrTail = stderrTail.slice(-12000);
      },
      onProgress: (p) => {
        const percent = totalSec > 0 ? Math.min(99.5, Math.max(0, (p.outTimeSec / totalSec) * 100)) : -1;
        emitter?.progress({ exportId, percent });
      },
    });

    if (abort.signal.aborted) {
      safeUnlink(outputPath);
      emitter?.done({ exportId, success: false, canceled: true });
    } else if (code === 0 && existsSync(outputPath)) {
      emitter?.progress({ exportId, percent: 100 });
      emitter?.done({ exportId, success: true, outputPath });
    } else {
      safeUnlink(outputPath);
      const detail = stderrTail.trim().split('\n').slice(-3).join(' ').trim();
      emitter?.done({ exportId, success: false, error: detail || `ffmpeg endete mit Code ${code}` });
    }
  } catch (err) {
    safeUnlink(outputPath);
    emitter?.done({ exportId, success: false, error: (err as Error).message });
  } finally {
    const a = active.get(exportId);
    if (a) {
      try {
        rmSync(a.tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup failure
      }
    }
    active.delete(exportId);
  }
}

function safeUnlink(p: string): void {
  try {
    if (existsSync(p)) rmSync(p, { force: true });
  } catch {
    // ignore
  }
}
