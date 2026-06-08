// Lädt das native Addon (build/Release/jm_ndi.node).
//
// Windows-Eigenheit: Die `.node` linkt gegen Processing.NDI.Lib.x64.lib und
// braucht zur Laufzeit die DLL `Processing.NDI.Lib.x64.dll`. Liegt die nicht im
// DLL-Suchpfad, scheitert das Laden mit Fehler 126 ("Das angegebene Modul wurde
// nicht gefunden") — obwohl die .node selbst da ist. Wir hängen deshalb vor dem
// Laden das NDI-Bin-Verzeichnis vorne an PATH (Dev: aus NDI-Runtime/-SDK; in der
// gepackten App liegt die DLL neben der .node und wird ohnehin gefunden).

const fs = require('node:fs');
const path = require('node:path');

function ensureNdiRuntimeOnPath() {
  if (process.platform !== 'win32') return;
  const dll = 'Processing.NDI.Lib.x64.dll';
  const candidates = [
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
      return dir;
    } catch {
      // Verzeichnis nicht lesbar → nächsten Kandidaten probieren
    }
  }
  return null;
}

ensureNdiRuntimeOnPath();

let addon;
try {
  addon = require('bindings')('jm_ndi');
} catch (err) {
  throw new Error(
    '@jm/ndi: natives Addon konnte nicht geladen werden.\n' +
      '  Build (Win/Mac): setx NDI_SDK_DIR "<Pfad zum NDI SDK>" && npm run rebuild -w @jm/ndi\n' +
      '  Laufzeit (Win):  NDI-Runtime/-SDK installiert? Ist Processing.NDI.Lib.x64.dll auffindbar?\n' +
      'Ursprünglicher Fehler: ' +
      (err && err.message ? err.message : String(err)),
  );
}

module.exports = addon;
