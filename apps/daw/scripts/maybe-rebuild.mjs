// Guard für den postinstall: electron-rebuild des nativen @jm/audio-Addons NUR,
// wenn ein PortAudio-Build vorhanden ist (PORTAUDIO_DIR gesetzt). Aufnahme ist
// optional — die DAW startet auch ohne gebautes @jm/audio (Import/Schnitt/Mix/
// Export laufen über Web Audio + FFmpeg, nur die Aufnahme braucht das Addon).
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
  console.log('[@jm/daw] PORTAUDIO_DIR nicht gesetzt — electron-rebuild übersprungen (Aufnahme deaktiviert).');
  console.log('[@jm/daw] Für die Aufnahme: PORTAUDIO_DIR setzen + `npm run rebuild:native -w @jm/daw`.');
  process.exit(0);
}

try {
  console.log(`[@jm/daw] PortAudio gefunden (${dir}) — baue @jm/audio für die Electron-ABI …`);
  execSync('electron-rebuild --only @jm/audio', { stdio: 'inherit' });
} catch (e) {
  console.warn('[@jm/daw] electron-rebuild fehlgeschlagen:', e instanceof Error ? e.message : String(e));
}
