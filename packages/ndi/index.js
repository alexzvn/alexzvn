// Lädt das native Addon (build/Release/jm_ndi.node). Wirft eine verständliche
// Meldung, wenn es (noch) nicht gebaut wurde — z. B. weil das NDI-SDK fehlt.
let addon;
try {
  addon = require('bindings')('jm_ndi');
} catch (err) {
  throw new Error(
    '@jm/ndi: natives Addon nicht gefunden. Auf Windows/Mac mit NDI-SDK bauen:\n' +
      '  setx NDI_SDK_DIR "<Pfad zum NDI SDK>"\n' +
      '  npm run rebuild -w @jm/ndi   (bzw. electron-rebuild --only @jm/ndi für Electron)\n' +
      'Ursprünglicher Fehler: ' +
      (err && err.message ? err.message : String(err)),
  );
}

module.exports = addon;
