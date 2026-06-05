# Gebündelte FFmpeg-Binaries

Diese App startet `ffmpeg`/`ffprobe` aus diesem Ordner (pro Plattform). Die
Binaries werden **nicht** im Git eingecheckt — sie müssen vor dem Packaging hier
abgelegt werden:

```
resources/bin/win/ffmpeg.exe
resources/bin/win/ffprobe.exe
resources/bin/mac/ffmpeg
resources/bin/mac/ffprobe
```

Empfohlene Voll-Builds mit Hardware-Beschleunigung:

- **Windows:** gyan.dev oder BtbN „ffmpeg-master-latest-win64-gpl" (enthält
  NVENC, QuickSync, libx264/x265/SVT-AV1).
- **macOS:** BtbN „macos64" oder evermeet.cx (enthält VideoToolbox). Für beide
  Architekturen je ein Build unter `mac/` ablegen bzw. ein universelles Binary.

Auf macOS müssen die Binaries ausführbar sein (`chmod +x`).

Fehlt für die aktuelle Plattform ein Binary, fällt die App auf ein
`ffmpeg`/`ffprobe` aus dem System-`PATH` zurück (praktisch für die Entwicklung).
