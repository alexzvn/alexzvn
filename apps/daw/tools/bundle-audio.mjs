// Staged beim `prepackage` (vor electron-builder) die für die Aufnahme nötigen
// Binaries nach resources/bin/win/ — von dort lädt @jm/audio sie zur Laufzeit:
//   1. das gebaute native Addon (@jm/audio → jm_audio.node, Electron-ABI)
//   2. die PortAudio-Runtime-DLL (portaudio.dll, SHARED-Build)
// Beide sind gitignored und werden pro Build frisch bereitgestellt. Identisch zu
// apps/recorder/tools/bundle-audio.mjs (gleiche @jm/audio-Basis).
//
// NUR auf Windows mit gebautem Addon sinnvoll (vorher:
//   $env:PORTAUDIO_DIR=…; npm run rebuild:native -w @jm/daw).
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');

if (process.platform !== 'win32') {
  console.log('[bundle-audio] Nicht-Windows — übersprungen (Mac später).');
  process.exit(0);
}

const buildRel = join(repoRoot, 'packages', 'audio', 'build', 'Release');
const addon = join(buildRel, 'jm_audio.node');
if (!existsSync(addon)) {
  throw new Error(
    `[bundle-audio] jm_audio.node nicht gefunden: ${addon}\n` +
      '  Erst bauen: $env:PORTAUDIO_DIR="<…>"; npm run rebuild:native -w @jm/daw',
  );
}

// portaudio.dll (SHARED-Build) suchen: neben dem Addon (Dev-Setup legt sie dort
// ab), sonst PORTAUDIO_DLL, sonst unter PORTAUDIO_DIR.
const pa = process.env.PORTAUDIO_DIR;
const dllCandidates = [
  join(buildRel, 'portaudio.dll'),
  process.env.PORTAUDIO_DLL,
  pa && join(pa, 'bin', 'portaudio.dll'),
  pa && join(pa, 'lib', 'portaudio.dll'),
  pa && join(pa, 'portaudio.dll'),
].filter(Boolean);
const dll = dllCandidates.find((p) => existsSync(p));
if (!dll) {
  throw new Error(
    '[bundle-audio] portaudio.dll nicht gefunden.\n' +
      '  Lege sie nach packages/audio/build/Release/ oder setze PORTAUDIO_DLL=<Pfad zur portaudio.dll>.',
  );
}

const destDir = join(appRoot, 'resources', 'bin', 'win');
mkdirSync(destDir, { recursive: true });
copyFileSync(addon, join(destDir, 'jm_audio.node'));
copyFileSync(dll, join(destDir, 'portaudio.dll'));
console.log(`bundled jm_audio.node + portaudio.dll → ${destDir}`);
