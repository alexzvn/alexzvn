import { app } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';

declare const __dirname: string;

function platformDir(): string {
  if (process.platform === 'win32') return 'win';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
}

function exe(name: string): string {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function bundledBinDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', platformDir());
  }
  // Bundelt sich in <app>/out/main/index.cjs → __dirname = out/main, also
  // ../../resources/bin = <app>/resources/bin (vom prepackage befüllt).
  return path.join(__dirname, '..', '..', 'resources', 'bin', platformDir());
}

/**
 * Resolve a bundled binary path, falling back to the bare name so a
 * PATH-installed binary is used during development (e.g. on Linux/codespace,
 * where we don't ship a binary).
 */
function resolveBinary(name: string): string {
  const bundled = path.join(bundledBinDir(), exe(name));
  return existsSync(bundled) ? bundled : name;
}

export function ffmpegPath(): string {
  return resolveBinary('ffmpeg');
}

export function ffprobePath(): string {
  return resolveBinary('ffprobe');
}
