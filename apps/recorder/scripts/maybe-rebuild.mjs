// Guard für den postinstall: electron-rebuild des nativen @jm/audio-Addons NUR,
// wenn ein PortAudio-Build vorhanden ist (PORTAUDIO_DIR gesetzt).
//
// Wichtig: `electron-rebuild` ruft intern `node-gyp rebuild`, das zuerst `clean`
// macht (build/ wird geleert). Ohne PORTAUDIO_DIR bricht das Konfigurieren ab und
// hinterlässt ein LEERES build/Release → "Could not locate the bindings file".
// Darum hier abbrechen, statt einen evtl. vorhandenen Build zu zerstören.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.PORTAUDIO_DIR;
if (!dir || !existsSync(join(dir, 'include'))) {
  console.log('[@jm/recorder] PORTAUDIO_DIR nicht gesetzt — electron-rebuild übersprungen.');
  console.log('[@jm/recorder] Auf Windows/Mac: PORTAUDIO_DIR setzen + `npm run rebuild:native -w @jm/recorder`.');
  process.exit(0);
}

try {
  console.log(`[@jm/recorder] PortAudio gefunden (${dir}) — baue @jm/audio für die Electron-ABI …`);
  execSync('electron-rebuild --only @jm/audio', { stdio: 'inherit' });
} catch (e) {
  console.warn('[@jm/recorder] electron-rebuild fehlgeschlagen:', e instanceof Error ? e.message : String(e));
}
