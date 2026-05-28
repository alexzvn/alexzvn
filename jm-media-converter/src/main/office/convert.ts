import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ConvertProgress, ConvertResult, OfficeConvertSpec } from '@shared/types';
import { locateSoffice } from './locate';

export interface OfficeEmitter {
  progress: (p: ConvertProgress) => void;
  done: (r: ConvertResult) => void;
}

let emitter: OfficeEmitter | null = null;
export function setOfficeEmitter(e: OfficeEmitter): void {
  emitter = e;
}

const queue: OfficeConvertSpec[] = [];
let busy = false;

export function enqueueOffice(spec: OfficeConvertSpec): void {
  queue.push(spec);
  void pump();
}

async function pump(): Promise<void> {
  if (busy || queue.length === 0) return;
  busy = true;
  const spec = queue.shift()!;
  try {
    await runJob(spec);
  } finally {
    busy = false;
    void pump();
  }
}

function runJob(spec: OfficeConvertSpec): Promise<void> {
  return new Promise<void>((resolve) => {
    void locateSoffice().then((soffice) => {
      if (!soffice) {
        emitter?.done({
          jobId: spec.jobId,
          success: false,
          error: 'LibreOffice wurde nicht gefunden. Bitte installieren.',
        });
        resolve();
        return;
      }

      emitter?.progress({ jobId: spec.jobId, percent: -1 });

      // Isolated profile so we don't clash with a running LibreOffice instance.
      const profileDir = mkdtempSync(path.join(tmpdir(), 'jmc-lo-'));
      const base = path.basename(spec.inputPath, path.extname(spec.inputPath));
      const outputPath = path.join(spec.outputDir, `${base}.pdf`);

      const args = [
        '--headless',
        '--norestore',
        '--nolockcheck',
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--convert-to',
        'pdf',
        '--outdir',
        spec.outputDir,
        spec.inputPath,
      ];

      let stderr = '';
      const child = execFile(soffice, args, { timeout: 180_000 }, (error, _stdout, errOut) => {
        stderr += errOut ?? '';
        try {
          rmSync(profileDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup failure
        }
        if (error && !existsSync(outputPath)) {
          emitter?.done({
            jobId: spec.jobId,
            success: false,
            error: stderr.trim().split('\n').slice(-2).join(' ') || error.message,
          });
        } else if (existsSync(outputPath)) {
          emitter?.done({ jobId: spec.jobId, success: true, outputPath });
        } else {
          emitter?.done({
            jobId: spec.jobId,
            success: false,
            error: 'Es wurde keine PDF erzeugt.',
          });
        }
        resolve();
      });
      child.on('error', (err) => {
        try {
          rmSync(profileDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
        emitter?.done({ jobId: spec.jobId, success: false, error: err.message });
        resolve();
      });
    });
  });
}
