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

// Falls PortAudio dynamisch gelinkt ist: das Addon-Verzeichnis vorne an PATH
// hängen, damit eine daneben liegende portaudio_x64.dll gefunden wird (Windows).
function ensureRuntimeOnPath(preferredDir) {
  if (process.platform !== 'win32' || !preferredDir) return;
  const parts = (process.env.PATH || '').split(path.delimiter);
  if (!parts.includes(preferredDir)) {
    process.env.PATH = preferredDir + path.delimiter + (process.env.PATH || '');
  }
}

const bundled = bundledBinDir();
ensureRuntimeOnPath(bundled);

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
