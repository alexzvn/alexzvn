import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

// Mirrors apps/media-converter/src/main/office/locate.ts — LibreOffice is a
// system dependency, not bundled. Returns null if it cannot be found.
const execFileAsync = promisify(execFile);

let cached: string | null | undefined;

function candidates(): string[] {
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    return [
      `${pf}\\LibreOffice\\program\\soffice.exe`,
      `${pf86}\\LibreOffice\\program\\soffice.exe`,
    ];
  }
  if (process.platform === 'darwin') {
    return ['/Applications/LibreOffice.app/Contents/MacOS/soffice'];
  }
  return ['/usr/bin/soffice', '/usr/bin/libreoffice', '/snap/bin/libreoffice'];
}

/** Returns the path to a usable `soffice` binary, or null if not installed. */
export async function locateSoffice(): Promise<string | null> {
  if (cached !== undefined) return cached;

  for (const candidate of candidates()) {
    if (existsSync(candidate)) {
      cached = candidate;
      return cached;
    }
  }

  // Last resort: rely on PATH.
  const bin = process.platform === 'win32' ? 'soffice.exe' : 'soffice';
  try {
    await execFileAsync(bin, ['--version'], { timeout: 8000 });
    cached = bin;
  } catch {
    cached = null;
  }
  return cached;
}
