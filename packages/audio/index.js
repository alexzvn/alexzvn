// Lädt das native Audio-Addon (jm_audio.node). Zwei Betriebsarten — wie @jm/ndi:
//
//  - Dev: Addon unter packages/audio/build/Release (geladen via `bindings`).
//  - Gepackte App: bundle-Schritt legt jm_audio.node (+ portaudio_x64.dll, falls
//    dynamisch gelinkt) nach resources/bin/<plat>. Wir laden direkt von dort; die
//    DLL daneben wird beim Laden automatisch gefunden (Windows durchsucht das
//    Verzeichnis der .node zuerst). Statisch gelinktes PortAudio braucht keine DLL.

const fs = require('node:fs');
const path = require('node:path');

function bundledBinDir() {
  const res = process.resourcesPath;
  if (!res) return null;
  const plat = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : null;
  if (!plat) return null;
  const dir = path.join(res, 'bin', plat);
  return fs.existsSync(path.join(dir, 'jm_audio.node')) ? dir : null;
}

// Dev: das gebaute Addon liegt unter packages/audio/build/Release.
function devBuildDir() {
  const d = path.join(__dirname, 'build', 'Release');
  return fs.existsSync(path.join(d, 'jm_audio.node')) ? d : null;
}

// Falls PortAudio dynamisch gelinkt ist (SHARED build → portaudio.dll), die
// in Frage kommenden Verzeichnisse vorne an PATH hängen, damit die DLL gefunden
// wird (Windows; sonst Lade-Fehler 126). Reihenfolge: Addon-Verzeichnis zuerst
// (gepackt bzw. dev build/Release), dann PORTAUDIO_DIR + PORTAUDIO_DIR/bin.
function ensureRuntimeOnPath(dirs) {
  if (process.platform !== 'win32') return;
  const parts = (process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    try {
      if (!fs.existsSync(dir) || parts.includes(dir)) continue;
    } catch {
      continue;
    }
    process.env.PATH = dir + path.delimiter + (process.env.PATH || '');
    parts.unshift(dir);
  }
}

const bundled = bundledBinDir();
const pa = process.env.PORTAUDIO_DIR;
ensureRuntimeOnPath([bundled, devBuildDir(), pa, pa && path.join(pa, 'bin'), pa && path.join(pa, 'lib')]);

let addon;
try {
  addon = bundled
    ? require(path.join(bundled, 'jm_audio.node')) // gepackte App
    : require('bindings')('jm_audio'); // Dev (packages/audio/build/Release)
} catch (err) {
  throw new Error(
    '@jm/audio: natives Addon konnte nicht geladen werden.\n' +
      '  Build (Win): PortAudio mit ASIO bauen, PORTAUDIO_DIR setzen, `npm run rebuild -w @jm/audio` (Details: README).\n' +
      '  Für Electron: electron-rebuild gegen das Addon laufen lassen.\n' +
      'Ursprünglicher Fehler: ' +
      (err && err.message ? err.message : String(err)),
  );
}

module.exports = addon;
