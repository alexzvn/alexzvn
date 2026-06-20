// Bündelt ffmpeg/ffprobe für dieses Tool. Die eigentliche Logik lebt in
// @jm/media (geteilt mit Player/Recorder/Switcher/Media-Converter); hier nur der
// Aufruf mit dem App-Root als Ziel. Wird als `prepackage` vor electron-builder ausgeführt.
import { bundleFfmpeg } from '@jm/media/bundle-ffmpeg.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
bundleFfmpeg(appRoot);
