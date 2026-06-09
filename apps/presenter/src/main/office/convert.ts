import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OfficeImportResult } from '@shared/types';
import { locateSoffice } from './locate';

/**
 * Converts an Office document (PPTX/DOCX/ODP/…) to PDF using a headless
 * LibreOffice and returns the resulting PDF bytes. Same invocation as the
 * Media Converter tool, but in-memory: the caller receives bytes, not a path.
 */
export async function convertOfficeToPdf(inputPath: string): Promise<OfficeImportResult> {
  const soffice = await locateSoffice();
  if (!soffice) {
    return {
      ok: false,
      error:
        'LibreOffice wurde nicht gefunden. Bitte installieren, um Office-Dateien zu importieren.',
    };
  }

  // Isolated profile + output dir so we never clash with a running instance.
  const profileDir = mkdtempSync(path.join(tmpdir(), 'jmpr-lo-prof-'));
  const outDir = mkdtempSync(path.join(tmpdir(), 'jmpr-lo-out-'));
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outDir, `${base}.pdf`);

  const args = [
    '--headless',
    '--norestore',
    '--nolockcheck',
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    '--convert-to',
    'pdf',
    '--outdir',
    outDir,
    inputPath,
  ];

  const cleanup = (): void => {
    for (const dir of [profileDir, outDir]) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup failure
      }
    }
  };

  return new Promise<OfficeImportResult>((resolve) => {
    let stderr = '';
    const child = execFile(soffice, args, { timeout: 180_000 }, (error, _stdout, errOut) => {
      stderr += errOut ?? '';
      if (existsSync(outputPath)) {
        try {
          const bytes = new Uint8Array(readFileSync(outputPath));
          resolve({ ok: true, name: `${base}.pdf`, bytes });
        } catch (err) {
          resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
        } finally {
          cleanup();
        }
        return;
      }
      cleanup();
      resolve({
        ok: false,
        error:
          stderr.trim().split('\n').slice(-2).join(' ') ||
          (error ? error.message : 'Es wurde keine PDF erzeugt.'),
      });
    });
    child.on('error', (err) => {
      cleanup();
      resolve({ ok: false, error: err.message });
    });
  });
}

/**
 * Same as convertOfficeToPdf but for in-memory bytes (used by the experimental
 * build-step expansion): writes them to a temp .pptx and converts that.
 */
export async function convertOfficeBytesToPdf(
  bytes: Uint8Array,
  baseName: string,
): Promise<OfficeImportResult> {
  const dir = mkdtempSync(path.join(tmpdir(), 'jmpr-lo-in-'));
  const inputPath = path.join(dir, `${baseName}.pptx`);
  try {
    writeFileSync(inputPath, bytes);
    return await convertOfficeToPdf(inputPath);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Lightweight PDF page count by counting page objects. Used only to sanity-check
 * the expanded conversion against the expected build-step total — a wrong count
 * just makes the caller fall back to the flat PDF, so exactness isn't critical.
 */
export function countPdfPages(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1');
  return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
