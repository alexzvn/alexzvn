import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { EncoderSupport, HwKind } from '@shared/types';
import { ffmpegPath } from './locate';

const execFileAsync = promisify(execFile);

let cached: EncoderSupport | null = null;

/** Hardware backend candidates to probe, in priority order per platform. */
function hwOrder(): { kind: HwKind; probe: string }[] {
  if (process.platform === 'darwin') {
    return [{ kind: 'videotoolbox', probe: 'h264_videotoolbox' }];
  }
  if (process.platform === 'win32') {
    return [
      { kind: 'nvenc', probe: 'h264_nvenc' },
      { kind: 'qsv', probe: 'h264_qsv' },
    ];
  }
  return [
    { kind: 'nvenc', probe: 'h264_nvenc' },
    { kind: 'vaapi', probe: 'h264_vaapi' },
  ];
}

export async function detectEncoders(): Promise<EncoderSupport> {
  if (cached) return cached;

  let available: string[] = [];
  try {
    const { stdout } = await execFileAsync(
      ffmpegPath(),
      ['-hide_banner', '-loglevel', 'error', '-encoders'],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    // Each encoder line looks like: " V..... libx264   H.264 ..."
    available = stdout
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[1])
      .filter((name): name is string => Boolean(name) && /^[a-z0-9_]+$/.test(name));
  } catch {
    // ffmpeg missing or failed — treat as software-only.
    cached = { hwKind: null, available: [] };
    return cached;
  }

  const set = new Set(available);
  let hwKind: HwKind | null = null;
  for (const candidate of hwOrder()) {
    if (set.has(candidate.probe)) {
      hwKind = candidate.kind;
      break;
    }
  }

  cached = { hwKind, available };
  return cached;
}
