import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { ffmpegPath } from './locate';

export interface FfmpegProgress {
  /** Output position in seconds (parsed from out_time_us/out_time_ms/out_time). */
  outTimeSec: number;
  /** Encoding speed multiplier (e.g. 1.5 for ffmpeg's "1.5x"), if reported. */
  speed?: number;
  /** Output frames per second, if reported. */
  fps?: number;
  /** Output frame number, if reported. */
  frame?: number;
  /** Output size in bytes, if reported. */
  totalSize?: number;
}

export interface SpawnFfmpegOptions {
  /**
   * Progress callbacks parsed from ffmpeg's `-progress pipe:1` key=value stream
   * on stdout. The caller must include `-progress pipe:1 -nostats` in `args`
   * (this helper only parses what ffmpeg writes there).
   */
  onProgress?: (p: FfmpegProgress) => void;
  /** Raw stderr chunks (ffmpeg logs there). */
  onStderr?: (chunk: string) => void;
  /** Receives the spawned child so the caller can kill/inspect it. */
  onSpawn?: (child: ChildProcessWithoutNullStreams) => void;
  /** Abort to terminate the process (sends SIGKILL). */
  signal?: AbortSignal;
  /** Override the ffmpeg binary (defaults to the bundled one). */
  ffmpeg?: string;
}

export interface FfmpegResult {
  /** Exit code (null if killed by signal). */
  code: number | null;
  /** Tail of stderr (last ~16 KB), useful for surfacing failure reasons. */
  stderr: string;
}

function parseOutTimeSec(value: string): number | null {
  // "HH:MM:SS.microseconds"
  const m = value.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Spawn ffmpeg, streaming structured progress and resolving on exit. Generic
 * counterpart to media-converter's bespoke convert loop — used by Player
 * (thumbnails/convert-handoff), Recorder (disk mux) and Switcher (record/RTMP).
 *
 * Rejects only if the process cannot be spawned; a non-zero exit resolves with
 * `{ code }` so callers decide how to treat it.
 */
export function spawnFfmpeg(
  args: string[],
  opts: SpawnFfmpegOptions = {},
): Promise<FfmpegResult> {
  return new Promise<FfmpegResult>((resolve, reject) => {
    const child = spawn(opts.ffmpeg ?? ffmpegPath(), args, { windowsHide: true });
    opts.onSpawn?.(child);

    const onAbort = (): void => {
      child.kill('SIGKILL');
    };
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    let stdoutBuf = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      if (!opts.onProgress) return;
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';

      let outSec: number | null = null;
      let speed: number | undefined;
      let fps: number | undefined;
      let frame: number | undefined;
      let totalSize: number | undefined;
      let flush = false;

      for (const line of lines) {
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        switch (key) {
          case 'out_time_us':
          case 'out_time_ms':
            // both reported in microseconds by ffmpeg
            if (value && value !== 'N/A') outSec = Number(value) / 1_000_000;
            break;
          case 'out_time':
            if (outSec == null) outSec = parseOutTimeSec(value);
            break;
          case 'fps':
            if (value && value !== 'N/A') fps = Number(value);
            break;
          case 'frame':
            if (value && value !== 'N/A') frame = Number(value);
            break;
          case 'total_size':
            if (value && value !== 'N/A') totalSize = Number(value);
            break;
          case 'speed':
            if (value && value !== 'N/A') speed = Number(value.replace('x', '')) || undefined;
            break;
          case 'progress':
            // ffmpeg writes one `progress=continue|end` per block — flush then.
            flush = true;
            break;
        }
      }

      if (flush && outSec != null) {
        opts.onProgress({ outTimeSec: outSec, speed, fps, frame, totalSize });
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      opts.onStderr?.(s);
      stderr += s;
      if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });

    child.on('error', (err) => {
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (code) => {
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      resolve({ code, stderr });
    });
  });
}
