import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { ConvertProgress, ConvertResult, RateControl, VideoConvertSpec } from '@shared/types';
import { getPreset, usesAudioBitrate, type VideoPreset } from '@shared/presets';
import { ffmpegPath } from './locate';
import { detectEncoders } from './encoders';

export interface ConvertEmitter {
  progress: (p: ConvertProgress) => void;
  done: (r: ConvertResult) => void;
}

let emitter: ConvertEmitter | null = null;
export function setVideoEmitter(e: ConvertEmitter): void {
  emitter = e;
}

interface ActiveJob {
  spec: VideoConvertSpec;
  child: ChildProcessWithoutNullStreams;
  outputPath: string;
  canceled: boolean;
}

const queue: VideoConvertSpec[] = [];
let active: ActiveJob | null = null;

export function enqueueVideo(spec: VideoConvertSpec): void {
  queue.push(spec);
  void pump();
}

export function cancelVideo(jobId: string): void {
  if (active && active.spec.jobId === jobId) {
    active.canceled = true;
    active.child.kill('SIGKILL');
    return;
  }
  const idx = queue.findIndex((s) => s.jobId === jobId);
  if (idx >= 0) {
    const [removed] = queue.splice(idx, 1);
    emitter?.done({ jobId: removed.jobId, success: false, canceled: true });
  }
}

async function pump(): Promise<void> {
  if (active || queue.length === 0) return;
  const spec = queue.shift()!;
  const preset = getPreset(spec.presetId);
  if (!preset) {
    emitter?.done({ jobId: spec.jobId, success: false, error: `Unbekanntes Preset: ${spec.presetId}` });
    void pump();
    return;
  }
  try {
    await runJob(spec, preset);
  } finally {
    active = null;
    void pump();
  }
}

export function pickEncoder(preset: VideoPreset, useHardware: boolean, available: string[], hwKind: string | null): string {
  if (useHardware && hwKind) {
    const enc = preset.hwEncoder?.[hwKind as keyof typeof preset.hwEncoder];
    if (enc && available.includes(enc)) return enc;
  }
  return preset.swEncoder;
}

/** Build the video rate-control args for the given encoder + mode. */
export function videoRateArgs(
  preset: VideoPreset,
  encoder: string,
  rateControl: RateControl,
  quality?: number | null,
  bitrateKbps?: number | null,
): string[] {
  if (preset.qualityKind !== 'crf') return []; // ProRes/DNxHR are profile-based

  if (rateControl === 'quality') {
    const q = quality ?? preset.defaultQuality ?? 22;
    if (encoder.endsWith('_nvenc')) return ['-rc', 'vbr', '-cq', String(q), '-b:v', '0'];
    if (encoder.endsWith('_qsv')) return ['-global_quality', String(q)];
    if (encoder.endsWith('_vaapi')) return ['-qp', String(q)];
    if (encoder.endsWith('_videotoolbox')) {
      const [lo, hi] = preset.qualityRange ?? [14, 32];
      const t = Math.min(1, Math.max(0, (q - lo) / (hi - lo)));
      const vq = Math.round(80 - t * 45); // lower CRF → higher VT quality
      return ['-q:v', String(Math.min(100, Math.max(1, vq)))];
    }
    return ['-crf', String(q)]; // libx264 / libx265 / libsvtav1
  }

  const kbps = Math.max(100, Math.round(bitrateKbps ?? 8000));
  const b = `${kbps}k`;
  const buf = `${kbps * 2}k`;

  if (rateControl === 'cbr') {
    if (encoder.endsWith('_nvenc')) return ['-rc', 'cbr', '-b:v', b];
    if (encoder.endsWith('_qsv')) return ['-b:v', b, '-maxrate', b, '-bufsize', buf];
    if (encoder.endsWith('_vaapi')) return ['-rc_mode', 'CBR', '-b:v', b];
    if (encoder.endsWith('_videotoolbox')) return ['-b:v', b];
    return ['-b:v', b, '-minrate', b, '-maxrate', b, '-bufsize', buf];
  }

  // vbr — target average bitrate
  if (encoder.endsWith('_nvenc')) return ['-rc', 'vbr', '-b:v', b, '-maxrate', `${Math.round(kbps * 1.5)}k`];
  if (encoder.endsWith('_qsv')) return ['-b:v', b];
  if (encoder.endsWith('_vaapi')) return ['-rc_mode', 'VBR', '-b:v', b];
  if (encoder.endsWith('_videotoolbox')) return ['-b:v', b];
  return ['-b:v', b];
}

function audioArgs(spec: VideoConvertSpec): string[] {
  const codec = spec.audioCodec;
  if (codec === 'none') return ['-an'];
  if (codec === 'copy') return ['-c:a', 'copy'];
  const args = ['-c:a', codec];
  if (usesAudioBitrate(codec) && spec.audioBitrateKbps) {
    args.push('-b:a', `${spec.audioBitrateKbps}k`);
  }
  return args;
}

export function scaleArgs(scaleHeight?: number | null): string[] {
  if (!scaleHeight) return [];
  return ['-vf', `scale=-2:${scaleHeight}:flags=lanczos`];
}

function sanitizeName(name: string): string {
  // Strip path separators and characters illegal on Windows.
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim() || 'output';
}

function resolveOutputPath(spec: VideoConvertSpec, preset: VideoPreset): string {
  const base =
    spec.outputName && spec.outputName.trim()
      ? sanitizeName(spec.outputName)
      : path.basename(spec.inputPath, path.extname(spec.inputPath));
  const sameAsInput = (p: string) => path.resolve(p) === path.resolve(spec.inputPath);
  let candidate = path.join(spec.outputDir, `${base}.${preset.container}`);
  let i = 1;
  while (existsSync(candidate) || sameAsInput(candidate)) {
    const suffix = i > 1 ? `-converted${i}` : '-converted';
    candidate = path.join(spec.outputDir, `${base}${suffix}.${preset.container}`);
    i += 1;
  }
  return candidate;
}

function parseOutTimeSec(value: string): number | null {
  // "HH:MM:SS.microseconds"
  const m = value.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function runJob(spec: VideoConvertSpec, preset: VideoPreset): Promise<void> {
  const { available, hwKind } = await detectEncoders();
  const encoder = pickEncoder(preset, spec.useHardware, available, hwKind);
  const outputPath = resolveOutputPath(spec, preset);

  // Trim: -ss before -i (fast input seek), -t = trimmed duration.
  const fullDur = spec.durationSec > 0 ? spec.durationSec : 0;
  const trimStart = spec.trimStartSec && spec.trimStartSec > 0 ? spec.trimStartSec : 0;
  const trimEnd = spec.trimEndSec != null && spec.trimEndSec > 0 ? spec.trimEndSec : fullDur;
  const trimActive = trimStart > 0 || (fullDur > 0 && trimEnd < fullDur);
  const outDur = Math.max(0, (trimEnd || fullDur) - trimStart);
  const progressDur = trimActive && outDur > 0 ? outDur : fullDur;

  const args = [
    '-y',
    ...(trimStart > 0 ? ['-ss', String(trimStart)] : []),
    '-i', spec.inputPath,
    ...(trimActive && outDur > 0 ? ['-t', String(outDur)] : []),
    ...scaleArgs(spec.scaleHeight),
    '-c:v', encoder,
    ...videoRateArgs(preset, encoder, spec.rateControl, spec.quality, spec.bitrateKbps),
    ...(preset.extraArgs ?? []),
    ...audioArgs(spec),
    '-progress', 'pipe:1',
    '-nostats',
    '-loglevel', 'error',
    outputPath,
  ];

  const child = spawn(ffmpegPath(), args, { windowsHide: true });
  active = { spec, child, outputPath, canceled: false };

  let stdoutBuf = '';
  let lastSpeed: string | undefined;
  let lastFps: number | undefined;
  let stderr = '';

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop() ?? '';
    let outSec: number | null = null;
    let ended = false;
    for (const line of lines) {
      const [key, rawValue] = line.split('=');
      if (!key) continue;
      const value = (rawValue ?? '').trim();
      switch (key.trim()) {
        case 'out_time_us':
        case 'out_time_ms':
          // both reported in microseconds by ffmpeg
          if (value && value !== 'N/A') outSec = Number(value) / 1_000_000;
          break;
        case 'out_time':
          if (outSec == null) outSec = parseOutTimeSec(value);
          break;
        case 'fps':
          if (value && value !== 'N/A') lastFps = Number(value);
          break;
        case 'speed':
          if (value && value !== 'N/A') lastSpeed = value;
          break;
        case 'progress':
          if (value === 'end') ended = true;
          break;
      }
    }
    if (outSec != null && !ended) {
      const dur = progressDur;
      const percent = dur > 0 ? Math.min(99.5, Math.max(0, (outSec / dur) * 100)) : -1;
      const speedNum = lastSpeed ? Number(lastSpeed.replace('x', '')) : 0;
      const etaSec = dur > 0 && speedNum > 0 ? Math.max(0, (dur - outSec) / speedNum) : undefined;
      emitter?.progress({ jobId: spec.jobId, percent, fps: lastFps, speed: lastSpeed, etaSec });
    }
  });

  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
    if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
  });

  await new Promise<void>((resolve) => {
    child.on('error', (err) => {
      emitter?.done({ jobId: spec.jobId, success: false, error: err.message });
      resolve();
    });
    child.on('close', (code) => {
      const job = active;
      if (job?.canceled) {
        if (existsSync(outputPath)) {
          try {
            rmSync(outputPath, { force: true });
          } catch {
            // ignore cleanup failure
          }
        }
        emitter?.done({ jobId: spec.jobId, success: false, canceled: true });
      } else if (code === 0) {
        emitter?.progress({ jobId: spec.jobId, percent: 100, fps: lastFps, speed: lastSpeed });
        emitter?.done({ jobId: spec.jobId, success: true, outputPath });
      } else {
        if (existsSync(outputPath)) {
          try {
            rmSync(outputPath, { force: true });
          } catch {
            // ignore
          }
        }
        const detail = stderr.trim().split('\n').slice(-3).join(' ').trim();
        emitter?.done({
          jobId: spec.jobId,
          success: false,
          error: detail || `ffmpeg endete mit Code ${code}`,
        });
      }
      resolve();
    });
  });
}
