# JM Player

Video-/Audio-Player für den Studio- und Event-Alltag: lokale **Bibliothek** +
**Playlists** (Lounge-/Einlass-Musik) und ein **Soundboard** mit Sofort-Cues
(„Theatergong") auf Hotkeys.

- **Wiedergabe:** HTML5-`<video>/<audio>` — spielt, was Chromium kann (H.264/VP9/
  AV1, AAC/MP3/Opus/FLAC). Bei nicht unterstütztem Codec: Hinweis „→ JM Media
  Converter". Lokale Dateien werden über das interne `jmedia://`-Protokoll
  ausgeliefert (kein `file://`-Web-Security-Stress).
- **Bibliothek/Playlists:** persistiert via [@jm/media-library](../../packages/media-library)
  (better-sqlite3) — übersteht Neustarts. Ordner-Import probt via
  [@jm/media](../../packages/media).
- **Soundboard:** Pads mit Hotkeys; Cues werden **vordekodiert** (WebAudio
  `AudioBuffer`) und latenzarm getriggert, getrennt vom Hintergrund-Player.

Port 5171 · `window.jmplay` · appId `gmbh.jakobs.player`.

## Entwicklung
```bash
npm run dev -w @jm/player
npm run typecheck -w @jm/player
```
Nativer Treiber (better-sqlite3) wird per `postinstall`/`rebuild:native`
(electron-rebuild) für Electron gebaut.

## v0.2-Ausblick
mpv/ffmpeg-Decode für Pro-Codecs (H.265/ProRes/DNxHR/AC3), Waveform-Thumbnails
für Audio, Crossfade/Gapless, Netzwerk-Fernbedienung.
