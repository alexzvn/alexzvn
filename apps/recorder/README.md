# JM Audio Recorder

Mehrkanal-Audio-Recorder für den Studio-/Event-Alltag — nimmt Standard-Eingänge,
System-Audio **und Dante** (über die Dante Virtual Soundcard via **ASIO**) auf.

- **Engine:** [@jm/audio](../../packages/audio) (PortAudio + ASIO-Host). Läuft im
  Main-Prozess; Frames kommen per ThreadSafeFunction in den Node-Loop.
- **Aufnahme → Disk (v0.1):** direkter **WAV-Writer** (32-bit float, mehrkanalig,
  interleaved) — verlustfrei, öffnet in Reaper/Audacity. Audio-Frames werden vom
  Addon **kopiert** (nicht transferiert — Lehre aus NDI).
- **Pegelmeter** pro Kanal (Arm = Eingang offen, Pegel sichtbar, noch keine Datei).

Port 5172 · `window.jmrec` · appId `gmbh.jakobs.recorder`.

> v0.2: Format-/Kompressions-Optionen via @jm/media (ffmpeg-Pipe), gezielte
> ASIO-Kanal-Auswahl, RF64/W64 für >4 GB.

## Entwicklung
```bash
npm run dev -w @jm/recorder
npm run typecheck -w @jm/recorder
```

## Native Engine bauen (Windows)
@jm/audio braucht ein gebautes PortAudio (mit ASIO) — siehe
`packages/audio/README.md`. Für den Betrieb im Electron-Main gegen die
Electron-ABI rebuilden:
```powershell
$env:PORTAUDIO_DIR = "C:\sdk\portaudio"
npm run rebuild:native -w @jm/recorder   # = electron-rebuild --only @jm/audio
```
Ohne gebautes Addon startet die App trotzdem (Engine wird lazy + abgesichert
geladen); Geräteliste/Aufnahme bleiben dann nur leer/inaktiv.

**Packaging-TODO (dist):** `jm_audio.node` (+ `portaudio.dll`, falls SHARED)
nach `resources/bin/win` bündeln — analog `apps/ndi-screen-capture/tools/bundle-ndi.mjs`.
