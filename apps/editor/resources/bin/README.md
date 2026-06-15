# Gebündelte FFmpeg-Binaries

Dieser Ordner wird beim Packaging (`npm run prepackage`) befüllt: `bundle-ffmpeg.mjs`
kopiert die plattformrichtigen `ffmpeg`/`ffprobe`-Binaries (aus `ffmpeg-static` /
`ffprobe-static`) nach `resources/bin/<win|mac|linux>/`. Zur Laufzeit lädt die App
sie von dort (siehe `@jm/media` `locate.ts`); im Dev fällt sie auf ein PATH-`ffmpeg` zurück.

Die Binaries sind gitignored (~80 MB) und werden pro Build frisch bereitgestellt.
