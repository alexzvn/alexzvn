// Guard: baut das native Audio-Addon nur, wenn ein PortAudio-Build vorhanden ist
// (PORTAUDIO_DIR gesetzt). So bricht `npm install` in Umgebungen ohne PortAudio/
// ASIO-SDK NICHT (z. B. Linux-Codespace, CI) — der native Build läuft erst auf
// einem Windows-/Mac-Rechner mit gebautem PortAudio (inkl. ASIO-Host auf Windows).
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.PORTAUDIO_DIR;

if (!dir) {
  console.log('[@jm/audio] PORTAUDIO_DIR nicht gesetzt — nativer Build übersprungen.');
  console.log('[@jm/audio] Auf Windows: PortAudio mit ASIO bauen, PORTAUDIO_DIR setzen, dann `npm run rebuild -w @jm/audio`. Siehe README.');
  process.exit(0);
}

if (!existsSync(join(dir, 'include'))) {
  console.warn(`[@jm/audio] PORTAUDIO_DIR="${dir}" enthält kein include/ — Build übersprungen.`);
  process.exit(0);
}

console.log(`[@jm/audio] PortAudio gefunden (${dir}) — baue natives Addon …`);
execSync('node-gyp rebuild', { stdio: 'inherit' });
