import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PreviewRequest, PreviewResult } from '@shared/types';
import { getPreset } from '@shared/presets';
import { ffmpegPath } from './locate';
import { detectEncoders } from './encoders';
import { pickEncoder, scaleArgs, videoRateArgs } from './convert';

const execFileAsync = promisify(execFile);
const OPTS = { maxBuffer: 8 * 1024 * 1024, windowsHide: true } as const;

/** Max width for the returned preview images, to keep the data URLs small. */
const DISPLAY_CAP = 900;

function dataUrl(file: string): string {
  return existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString('base64')}` : '';
}

export async function previewFrame(req: PreviewRequest): Promise<PreviewResult> {
  const preset = getPreset(req.presetId);
  if (!preset) throw new Error(`Unbekanntes Preset: ${req.presetId}`);

  const { available, hwKind } = await detectEncoders();
  if (available.length === 0) throw new Error('FFmpeg wurde nicht gefunden.');
  const encoder = pickEncoder(preset, req.useHardware, available, hwKind);

  const dur = req.durationSec > 0 ? req.durationSec : 0;
  const segmentSec = dur > 0 ? Math.min(2, Math.max(0.5, dur)) : 1.5;
  const atSec = dur > 0 ? Math.min(Math.max(0, req.atSec), Math.max(0, dur - segmentSec)) : Math.max(0, req.atSec);
  const frameOffset = Math.min(segmentSec / 2, 0.5);

  // Apply target scale (if any) then cap display width — both frames identically.
  const displayVf = [
    ...(req.scaleHeight ? [`scale=-2:${req.scaleHeight}:flags=lanczos`] : []),
    `scale='min(${DISPLAY_CAP},iw)':-2`,
  ].join(',');

  const tmp = mkdtempSync(path.join(tmpdir(), 'jmc-prev-'));
  const seg = path.join(tmp, `seg.${preset.container}`);
  const origPng = path.join(tmp, 'orig.png');
  const encPng = path.join(tmp, 'enc.png');

  try {
    // 1) Encode a short segment with the exact target settings (no audio).
    await execFileAsync(
      ffmpegPath(),
      [
        '-y',
        '-ss', String(atSec),
        '-i', req.inputPath,
        '-t', String(segmentSec),
        ...scaleArgs(req.scaleHeight),
        '-c:v', encoder,
        ...videoRateArgs(preset, encoder, req.rateControl, req.quality, req.bitrateKbps),
        ...(preset.extraArgs ?? []),
        '-an',
        '-loglevel', 'error',
        seg,
      ],
      OPTS,
    );

    // 2) Decode a frame back out of the encoded segment (shows real artifacts).
    await execFileAsync(
      ffmpegPath(),
      [
        '-y', '-ss', String(frameOffset), '-i', seg,
        '-frames:v', '1',
        '-vf', `scale='min(${DISPLAY_CAP},iw)':-2`,
        '-loglevel', 'error', encPng,
      ],
      OPTS,
    );

    // 3) Grab the matching frame from the original (same resolution + display cap).
    await execFileAsync(
      ffmpegPath(),
      [
        '-y', '-ss', String(atSec + frameOffset), '-i', req.inputPath,
        '-frames:v', '1',
        '-vf', displayVf,
        '-loglevel', 'error', origPng,
      ],
      OPTS,
    );

    const segBytes = existsSync(seg) ? statSync(seg).size : 0;
    const estimatedBytes = dur > 0 && segmentSec > 0 ? Math.round((segBytes / segmentSec) * dur) : 0;

    return {
      originalDataUrl: dataUrl(origPng),
      encodedDataUrl: dataUrl(encPng),
      estimatedBytes,
      segmentSec,
    };
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
  }
}
