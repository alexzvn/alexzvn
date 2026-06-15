import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectEncoders, ffmpegPath, spawnFfmpeg } from '@jm/media';
import { newId, type Project } from '@shared/project';
import { getPreset, type VideoPreset } from '@shared/presets';
import type { ExportProgress, ExportRequest, ExportResult } from '@shared/ipc-types';
import { buildPlan } from './plan';

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

export function pickEncoder(preset: VideoPreset, useHardware: boolean, available: string[], hwKind: string | null): string {
  if (preset.qualityKind !== 'crf') return preset.swEncoder; // ProRes/DNxHR: software-only
  if (useHardware && hwKind) {
    const enc = preset.hwEncoder?.[hwKind as keyof typeof preset.hwEncoder];
    if (enc && available.includes(enc)) return enc;
  }
  return preset.swEncoder;
}

/** Startet einen Export-Job; das Ergebnis kommt über die Emitter-Events. */
export async function startExport(req: ExportRequest): Promise<{ exportId: string }> {
  const exportId = newId('exp');
  // Async anstoßen, sofort die ID zurückgeben (UI zeigt Fortschritt via Events).
  void run(exportId, req);
  return { exportId };
}

async function run(exportId: string, req: ExportRequest): Promise<void> {
  const { project, outputPath } = req;
  const preset = getPreset(project.export.presetId);
  if (!preset) {
    emitter?.done({ exportId, success: false, error: `Unbekanntes Preset: ${project.export.presetId}` });
    return;
  }

  const tmpDir = mkdtempSync(path.join(tmpdir(), 'jmed-export-'));
  const abort = new AbortController();
  active.set(exportId, { abort, tmpDir, outputPath });

  try {
    // Titel-PNGs auf Platte schreiben (vom Renderer als data:URL geliefert).
    const titleFiles = new Map<string, string>();
    for (const t of req.titleImages) {
      const base64 = t.dataUrl.replace(/^data:image\/png;base64,/, '');
      const file = path.join(tmpDir, `${t.clipId}.png`);
      writeFileSync(file, Buffer.from(base64, 'base64'));
      titleFiles.set(t.clipId, file);
    }

    const { available, hwKind } = await detectEncoders();
    const encoder = pickEncoder(preset, project.export.useHardware, available, hwKind);

    const { args, totalSec } = buildPlan({ project, titleFiles, encoder });
    const fullArgs = [...args, outputPath];

    let stderrTail = '';
    const { code } = await spawnFfmpeg(fullArgs, {
      signal: abort.signal,
      ffmpeg: ffmpegPath(),
      onStderr: (s) => {
        stderrTail += s;
        if (stderrTail.length > 16000) stderrTail = stderrTail.slice(-16000);
      },
      onProgress: (p) => {
        const percent = totalSec > 0 ? Math.min(99.5, Math.max(0, (p.outTimeSec / totalSec) * 100)) : -1;
        const etaSec = totalSec > 0 && p.speed && p.speed > 0 ? Math.max(0, (totalSec - p.outTimeSec) / p.speed) : undefined;
        emitter?.progress({ exportId, percent, fps: p.fps, speed: p.speed ? `${p.speed}x` : undefined, etaSec });
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

/** Reiner Export ohne Job-Verwaltung — für Tests/CLI (gibt die ffmpeg-Args zurück). */
export function planFor(project: Project, titleFiles: Map<string, string>, encoder: string): string[] {
  return buildPlan({ project, titleFiles, encoder }).args;
}
