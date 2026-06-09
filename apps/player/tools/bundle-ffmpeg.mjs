// Bündelt ffmpeg/ffprobe für den Player (Thumbnails). Logik in @jm/media,
// hier nur der Aufruf mit dem App-Root als Ziel. `prepackage` vor electron-builder.
import { bundleFfmpeg } from '@jm/media/bundle-ffmpeg.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
bundleFfmpeg(appRoot);
