// Staged beim `prepackage` (vor electron-builder) ffmpeg/ffprobe (aus
// ffmpeg-static/ffprobe-static via @jm/media) nach resources/bin/<platform>/ —
// von dort lädt @jm/media sie zur Laufzeit. Reine statische Binaries (kein
// lizenziertes SDK) → in CI baubar. Muster: apps/media-converter/tools/bundle-ffmpeg.mjs.
import { bundleFfmpeg } from '@jm/media/bundle-ffmpeg.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
bundleFfmpeg(appRoot);
