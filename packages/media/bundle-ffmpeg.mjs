// Kopiert die plattformrichtigen ffmpeg/ffprobe-Binaries (aus ffmpeg-static /
// ffprobe-static, die beim `npm install` für die aktuelle Plattform geladen
// werden) nach <appRoot>/resources/bin/<win|mac|linux>/ — von dort lädt die App
// sie zur Laufzeit (siehe src/locate.ts). Aus der `prepackage` des jeweiligen
// Tools aufrufen. Die Binaries sind gitignored und werden so pro Build frisch
// bereitgestellt (sie sind ~80 MB groß und sprengen GitHubs Datei-Limit).
import { existsSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * @param {string} appRoot - Wurzel des konsumierenden Tools (Standard: CWD,
 *   d. h. der App-Ordner, aus dem `prepackage` läuft).
 */
export function bundleFfmpeg(appRoot = process.cwd()) {
  const platformDir =
    process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
  const ext = process.platform === 'win32' ? '.exe' : '';
  const destDir = join(appRoot, 'resources', 'bin', platformDir);

  // ffmpeg-static: Default-Export = Pfad zur Binary. ffprobe-static: { path }.
  const sources = [
    { name: 'ffmpeg', src: require('ffmpeg-static') },
    { name: 'ffprobe', src: require('ffprobe-static').path },
  ];

  mkdirSync(destDir, { recursive: true });
  for (const { name, src } of sources) {
    if (!src || !existsSync(src)) {
      throw new Error(`Quelle für ${name} nicht gefunden: ${src}`);
    }
    const dest = join(destDir, name + ext);
    copyFileSync(src, dest);
    if (process.platform !== 'win32') chmodSync(dest, 0o755);
    console.log(`bundled ${name} → ${dest}`);
  }
}

// Direkt ausgeführt (`node bundle-ffmpeg.mjs [appRoot]`) → ins CWD bzw. arg[0].
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  bundleFfmpeg(process.argv[2]);
}
