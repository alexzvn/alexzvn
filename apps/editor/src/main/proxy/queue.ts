import { app } from 'electron';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { ffmpegPath, spawnFfmpeg } from '@jm/media';
import { usToSec, type MediaAsset } from '@shared/project';
import type { ProxyProgress, ProxyResult } from '@shared/ipc-types';

export interface ProxyEmitter {
  progress: (p: ProxyProgress) => void;
  done: (r: ProxyResult) => void;
}

let emitter: ProxyEmitter | null = null;
export function setProxyEmitter(e: ProxyEmitter): void {
  emitter = e;
}

// Codecs, die Chromium im <video> direkt dekodiert → kein Proxy nötig.
// Alles andere (ProRes, MXF/XDCAM, DNxHD, MPEG-2, ProRes RAW …) bekommt einen Proxy.
const WEB_VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1', 'theora']);

export function needsProxy(asset: MediaAsset): boolean {
  if (asset.kind !== 'video' || !asset.hasVideo) return false;
  const codec = asset.probe?.video?.codec ?? '';
  if (!WEB_VIDEO_CODECS.has(codec)) return true;
  // Sehr große Quellen für flüssiges Scrubbing ebenfalls verkleinern.
  return (asset.height ?? 0) > 1440;
}

function proxyDir(): string {
  const dir = path.join(app.getPath('userData'), 'proxies');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Stabiler Cache-Schlüssel aus Pfad + Größe + mtime (Quelle geändert → neuer Proxy). */
function proxyPathFor(asset: MediaAsset): string {
  let stamp = '';
  try {
    const st = statSync(asset.path);
    stamp = `${st.size}:${Math.round(st.mtimeMs)}`;
  } catch {
    stamp = 'nostat';
  }
  const hash = createHash('sha1').update(`${asset.path}|${stamp}`).digest('hex').slice(0, 16);
  return path.join(proxyDir(), `${hash}.mp4`);
}

interface Job {
  asset: MediaAsset;
  outPath: string;
}
const queue: Job[] = [];
let active: { job: Job; abort: AbortController } | null = null;

export async function ensureProxy(asset: MediaAsset): Promise<void> {
  if (!needsProxy(asset)) {
    // Original ist direkt abspielbar → kein Proxy.
    emitter?.done({ assetId: asset.id, success: true });
    return;
  }
  const outPath = proxyPathFor(asset);
  if (existsSync(outPath)) {
    emitter?.done({ assetId: asset.id, success: true, proxyPath: outPath });
    return;
  }
  if (active?.job.asset.id === asset.id || queue.some((j) => j.asset.id === asset.id)) return;
  queue.push({ asset, outPath });
  void pump();
}

async function pump(): Promise<void> {
  if (active || queue.length === 0) return;
  const job = queue.shift()!;
  const abort = new AbortController();
  active = { job, abort };
  try {
    await build(job, abort.signal);
  } finally {
    active = null;
    void pump();
  }
}

async function build(job: Job, signal: AbortSignal): Promise<void> {
  const { asset, outPath } = job;
  const durSec = usToSec(asset.durationUs);

  // 720p, all-intra (jedes Bild ein Keyframe) → frame-genaues Scrubbing in <video>.
  const args = [
    '-y',
    '-i', asset.path,
    '-vf', 'scale=-2:720:flags=fast_bilinear',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-g', '1',
    '-keyint_min', '1',
    '-sc_threshold', '0',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-progress', 'pipe:1',
    '-nostats',
    '-loglevel', 'error',
    outPath,
  ];

  let stderrTail = '';
  try {
    const { code } = await spawnFfmpeg(args, {
      signal,
      ffmpeg: ffmpegPath(),
      onStderr: (s) => {
        stderrTail += s;
        if (stderrTail.length > 8000) stderrTail = stderrTail.slice(-8000);
      },
      onProgress: (p) => {
        const percent = durSec > 0 ? Math.min(99, Math.max(0, (p.outTimeSec / durSec) * 100)) : -1;
        emitter?.progress({ assetId: asset.id, percent });
      },
    });
    if (code === 0 && existsSync(outPath)) {
      emitter?.done({ assetId: asset.id, success: true, proxyPath: outPath });
    } else {
      safeUnlink(outPath);
      const detail = stderrTail.trim().split('\n').slice(-2).join(' ').trim();
      emitter?.done({ assetId: asset.id, success: false, error: detail || `ffmpeg endete mit Code ${code}` });
    }
  } catch (err) {
    safeUnlink(outPath);
    emitter?.done({ assetId: asset.id, success: false, error: (err as Error).message });
  }
}

function safeUnlink(p: string): void {
  try {
    if (existsSync(p)) rmSync(p, { force: true });
  } catch {
    // ignore
  }
}
