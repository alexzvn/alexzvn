import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { statSync } from 'node:fs';
import path from 'node:path';
import type { MediaInfo, MediaStreamInfo } from '@shared/types';
import { ffprobePath } from './locate';

const execFileAsync = promisify(execFile);

interface RawStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  sample_rate?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

interface RawProbe {
  format?: { duration?: string; format_name?: string };
  streams?: RawStream[];
}

function parseFps(value?: string): number | undefined {
  if (!value) return undefined;
  const [num, den] = value.split('/').map(Number);
  if (!num || !den) return undefined;
  return Math.round((num / den) * 1000) / 1000;
}

export async function probeMedia(filePath: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync(
    ffprobePath(),
    [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );

  const raw = JSON.parse(stdout) as RawProbe;
  const streams: MediaStreamInfo[] = (raw.streams ?? []).map((s) => {
    const type =
      s.codec_type === 'video'
        ? 'video'
        : s.codec_type === 'audio'
          ? 'audio'
          : s.codec_type === 'subtitle'
            ? 'subtitle'
            : 'other';
    return {
      type,
      codec: s.codec_name ?? 'unknown',
      width: s.width,
      height: s.height,
      fps: parseFps(s.avg_frame_rate) ?? parseFps(s.r_frame_rate),
      channels: s.channels,
      sampleRate: s.sample_rate ? Number(s.sample_rate) : undefined,
    };
  });

  const v = streams.find((s) => s.type === 'video');
  const a = streams.find((s) => s.type === 'audio');

  let sizeBytes = 0;
  try {
    sizeBytes = statSync(filePath).size;
  } catch {
    // ignore — size is informational only
  }

  return {
    path: filePath,
    fileName: path.basename(filePath),
    durationSec: raw.format?.duration ? Number(raw.format.duration) : 0,
    sizeBytes,
    format: raw.format?.format_name ?? '',
    streams,
    video:
      v && v.width && v.height
        ? { codec: v.codec, width: v.width, height: v.height, fps: v.fps ?? 0 }
        : undefined,
    audio: a
      ? { codec: a.codec, channels: a.channels ?? 0, sampleRate: a.sampleRate ?? 0 }
      : undefined,
  };
}
