// Staged beim `prepackage` (vor electron-builder) die Laufzeit-Binaries:
//   1. ffmpeg/ffprobe (über @jm/media) → resources/bin/<plat>
//   2. whisper.cpp-CLI + nötige DLLs (aus WHISPER_DIR) → resources/bin/win
//   3. Basismodell ggml-base.bin (aus WHISPER_MODEL_BASE) → resources/models
// Alle gitignored, pro Build frisch. NUR Windows (Mac später).
import { bundleFfmpeg } from '@jm/media/bundle-ffmpeg.mjs';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ffmpeg/ffprobe für die aktuelle Plattform.
bundleFfmpeg(appRoot);

if (process.platform !== 'win32') {
  console.log('[bundle-whisper] Nicht-Windows — whisper/Modell übersprungen (Mac später).');
  process.exit(0);
}

const whisperDir = process.env.WHISPER_DIR;
if (!whisperDir) {
  throw new Error(
    '[bundle-whisper] WHISPER_DIR nicht gesetzt — Ordner mit whisper-cli.exe + DLLs erwartet ' +
      '(z. B. aus dem whisper.cpp-Windows-Release whisper-bin-x64).',
  );
}
const baseModel = process.env.WHISPER_MODEL_BASE;
if (!baseModel || !existsSync(baseModel)) {
  throw new Error(
    '[bundle-whisper] WHISPER_MODEL_BASE nicht gefunden — Pfad zu ggml-base.bin erwartet.',
  );
}

// Den ganzen whisper-Ordner (Binary + DLLs) nach resources/bin/win kopieren.
const binDest = join(appRoot, 'resources', 'bin', 'win');
mkdirSync(binDest, { recursive: true });
let copied = 0;
for (const name of readdirSync(whisperDir)) {
  const src = join(whisperDir, name);
  if (!statSync(src).isFile()) continue;
  if (!/\.(exe|dll)$/i.test(name)) continue;
  copyFileSync(src, join(binDest, name));
  copied++;
}
if (copied === 0) {
  throw new Error(`[bundle-whisper] Keine .exe/.dll in WHISPER_DIR gefunden: ${whisperDir}`);
}
console.log(`bundled ${copied} whisper-Dateien → ${binDest}`);

// Basismodell.
const modelDest = join(appRoot, 'resources', 'models');
mkdirSync(modelDest, { recursive: true });
copyFileSync(baseModel, join(modelDest, 'ggml-base.bin'));
console.log(`bundled ${basename(baseModel)} → ${join(modelDest, 'ggml-base.bin')}`);
