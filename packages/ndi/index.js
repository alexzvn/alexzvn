// Lädt das native Addon (jm_ndi.node) + sorgt dafür, dass die NDI-Runtime-DLL
// gefunden wird. Zwei Betriebsarten:
//
//  - Dev: Addon liegt unter packages/ndi/build/Release (geladen via `bindings`);
//    die DLL kommt aus dem installierten NDI-SDK/-Runtime (NDI_SDK_DIR bzw.
//    wohlbekannte Pfade), die wir vor dem Laden an PATH hängen.
//  - Gepackte App: bundle-ndi.mjs legt jm_ndi.node + Processing.NDI.Lib.x64.dll
//    zusammen nach resources/bin/<plat>. Wir laden das Addon direkt von dort; die
//    DLL daneben wird beim Laden automatisch gefunden (Windows durchsucht das
//    Verzeichnis der .node zuerst). So braucht der Zielrechner KEIN NDI-SDK.
//
// Windows-Eigenheit: Ohne auffindbare Processing.NDI.Lib.x64.dll scheitert das
// Laden mit Fehler 126 ("Das angegebene Modul wurde nicht gefunden").

const fs = require('node:fs');
const path = require('node:path');

// Verzeichnis der gebündelten Binaries in der gepackten App (resources/bin/<plat>)
// — oder null im Dev-/ungepackten Fall.
function bundledBinDir() {
  const res = process.resourcesPath;
  if (!res) return null;
  const plat = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : null;
  if (!plat) return null;
  const dir = path.join(res, 'bin', plat);
  return fs.existsSync(path.join(dir, 'jm_ndi.node')) ? dir : null;
}

// Hängt das Verzeichnis mit der NDI-Runtime-DLL vorne an PATH (nur Windows).
function ensureNdiRuntimeOnPath(preferredDir) {
  if (process.platform !== 'win32') return;
  const dll = 'Processing.NDI.Lib.x64.dll';
  const candidates = [
    preferredDir, // gepackte App: DLL liegt neben dem Addon
    process.env.NDI_RUNTIME_DIR_V6, // vom NDI-Runtime-Installer gesetzt
    process.env.NDI_SDK_DIR && path.join(process.env.NDI_SDK_DIR, 'Bin', 'x64'),
    'C:\\Program Files\\NDI\\NDI 6 Runtime\\v6',
    'C:\\Program Files\\NDI\\NDI 6 SDK\\Bin\\x64',
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(path.join(dir, dll))) continue;
      const parts = (process.env.PATH || '').split(path.delimiter);
      if (!parts.includes(dir)) process.env.PATH = dir + path.delimiter + (process.env.PATH || '');
      return;
    } catch {
      // Verzeichnis nicht lesbar → nächsten Kandidaten probieren
    }
  }
}

const bundled = bundledBinDir();
ensureNdiRuntimeOnPath(bundled);

let addon;
try {
  addon = bundled
    ? require(path.join(bundled, 'jm_ndi.node')) // gepackte App
    : require('bindings')('jm_ndi'); // Dev (packages/ndi/build/Release)
} catch (err) {
  throw new Error(
    '@jm/ndi: natives Addon konnte nicht geladen werden.\n' +
      '  Build (Win/Mac): setx NDI_SDK_DIR "<Pfad zum NDI SDK>" && npm run rebuild -w @jm/ndi\n' +
      '  Laufzeit (Win):  NDI-Runtime/-SDK installiert bzw. DLL gebündelt?\n' +
      'Ursprünglicher Fehler: ' +
      (err && err.message ? err.message : String(err)),
  );
}

module.exports = addon;
