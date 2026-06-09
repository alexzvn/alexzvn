// Guard: baut das native Addon nur, wenn das NDI-SDK vorhanden ist
// (NDI_SDK_DIR gesetzt). So bricht `npm install` in Umgebungen ohne SDK
// (z. B. Linux-Codespace, CI) NICHT — der native Build läuft erst auf einem
// Windows-/Mac-Rechner mit installiertem NDI-SDK.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const sdk = process.env.NDI_SDK_DIR;

if (!sdk) {
  console.log('[@jm/ndi] NDI_SDK_DIR nicht gesetzt — nativer Build übersprungen.');
  console.log('[@jm/ndi] Auf Windows/Mac: NDI-SDK installieren, NDI_SDK_DIR setzen, dann `npm run rebuild -w @jm/ndi`.');
  process.exit(0);
}

if (!existsSync(join(sdk, 'Include'))) {
  console.warn(`[@jm/ndi] NDI_SDK_DIR="${sdk}" enthält kein Include/ — Build übersprungen.`);
  process.exit(0);
}

console.log(`[@jm/ndi] NDI-SDK gefunden (${sdk}) — baue natives Addon …`);
execSync('node-gyp rebuild', { stdio: 'inherit' });
