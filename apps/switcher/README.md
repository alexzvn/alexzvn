# JM Switcher

Softwarebasierter Video-Mischer (fokussierter, self-contained MVP — kein OBS
unter der Haube) mit **Program/Preview**, **Cut** und **Auto (Dissolve)**.

Port 5181 · `window.jmswitch` · appId `gmbh.jakobs.switcher`.

## Status — in Slices gebaut

- **Slice 1:** Compositor-Kern. Program/Preview-Monitore, **Cut** + **Auto
  (Dissolve)**. Quellen: **Farbe/Test** und **Bildschirm/Fenster** (Electron
  `desktopCapturer` + `getDisplayMedia` → `<video>` → Canvas-Compositing, rAF).
- **Slice 2 (OBS-Szenen/PiP):** Modell jetzt **Quellen-Pool → Szenen (geordnete
  Ebenen mit Position/Größe) → Program/Preview schaltet Szenen**. Szenen-Panel
  (anlegen/umbenennen/löschen), Ebenen-Editor (Sichtbarkeit, Z-Reihenfolge,
  Layout-Presets: Vollbild / PiP-Ecken / Hälften) → **PiP** in Sekunden baubar.
  Drag-/Resize-Editing direkt auf dem Monitor = v0.2.
- **Slice 3 (NDI-Empfang):** **NDI-Quelle** im Pool. „+ NDI" sucht Quellen im
  Studio-LAN (JM NDI Screen Capture, TriCaster, vMix …) und verbindet **einen**
  Empfänger (Addon-Limit). Der native `@jm/ndi`-Empfänger läuft in einem
  **utilityProcess** (`receive()` pollt blockierend) → Frames per **Kopie** über
  den Main an den Renderer-Compositor (Copy-not-transfer-Disziplin aus der NDI
  Screen Capture); 1-Frame-Backpressure (Ack) hält Latenz/Speicher im Zaum. BGRA
  → RGBA-Swizzle im Renderer (Uint32-Fastpath) in ein Offscreen-Canvas, das wie
  ein Video in die Ebene gezeichnet wird.
- **Slice 4 (Capture-Karte):** **„+ Capture"** listet Videogeräte (`enumerate
  Devices`) und öffnet sie via `getUserMedia` → gleicher Canvas-Pfad wie der
  Bildschirm. Deckt USB-Capture-Karten (Elgato, Magewell, Grabber) ab, Win **und**
  Mac, ohne nativen Prozess. ffmpeg-`dshow` für reine SDI-Karten ohne UVC = v0.2.
- **Slice 5 (Aufnahme + RTMP):** Der Program-Canvas wird per `captureStream` +
  **MediaRecorder** (WebM) kodiert. **Aufnahme** schreibt die WebM-Chunks direkt
  in eine Datei (Speicherdialog, `.webm`; → JM Media Converter für MP4). **Stream**
  pipet dieselben Chunks in **ffmpeg** (`@jm/media`) → H.264 + stille AAC-Spur
  (`anullsrc`, damit YouTube/Twitch die FLV akzeptieren) → **RTMP**. Pro Output ein
  eigener MediaRecorder (sauberer WebM-Header je Sink). Audio-Mix → v0.2.
  **RTMP-Ziel + Bitrate** liegen im **Einstellungen-Tab** (persistiert); der
  Stream-Start-Button bleibt in der Mischer-Ansicht.
- **Slice 6:** **TCP-Steuerserver** + **@jm/companion-protocol** + Bitfocus-
  **Companion-Modul** (`packages/companion-jm-switcher`): PREVIEW/PROGRAM/CUT/
  AUTO/RECORD/STREAM + State-Feedback.

ATEM-Hardware-Steuerung, SRT, mehrere Karten gleichzeitig, mehrere NDI-Empfänger,
Keying, Audio-Mischmatrix = v0.2+.

## Entwicklung
```bash
npm run dev -w @jm/switcher
npm run typecheck -w @jm/switcher
```
Quellen-Pool: „+ Farbe" (Farbe per Picker frei änderbar), „+ Bildschirm" (Monitor/
Fenster), „+ Capture" (Capture-Karte/Kamera via getUserMedia), „+ NDI" (suchen →
verbinden), „+ Bild" (PNG/JPG-Import, z. B. **Corner-Logos** mit Transparenz — PiP-
Ecken-Preset macht daraus ein Bauchbinden-/Logo-Overlay). Quellen per **Doppelklick
umbenennen**. Compositing läuft komplett im Renderer (Canvas).

### NDI (nativ, nur Windows/Mac mit gebautem Addon)
Wie bei [JM NDI Screen Capture](../ndi-screen-capture): das `@jm/ndi`-Addon wird
**lokal** gebaut (NDI-SDK nicht in CI). Vor `dev`/`dist` einmalig:
```bash
setx NDI_SDK_DIR "<Pfad zum NDI 6 SDK>"   # Windows
npm run rebuild:native -w @jm/switcher     # Addon für die Electron-ABI bauen
```
`npm run dist:win` stuft via `bundle-ndi` Addon + Runtime-DLL nach
`resources/bin/win` — der Zielrechner braucht dann kein NDI-SDK. Ohne gebautes
Addon startet die App normal; nur „+ NDI" liefert dann keine Quellen.

### ffmpeg (RTMP-Stream)
Die **Aufnahme** braucht kein ffmpeg (WebM direkt). Der **RTMP-Stream** nutzt
ffmpeg aus `@jm/media`: `npm run dist*` bündelt es via `bundle-ffmpeg` nach
`resources/bin`. Im Dev wird ffmpeg vom PATH genutzt (sonst `npm run prepackage
-w @jm/switcher` einmal ausführen, dann liegt es in `resources/bin`).
