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
- **Slice 4:** eine **Capture-Karte** (ffmpeg dshow) als Quelle.
- **Slice 5:** **Aufnahme** (ffmpeg) + **RTMP**-Ausgabe des Program-Outputs.
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
Bildschirmquelle: „+ Bildschirm" wählt einen Monitor/ein Fenster; das Compositing
läuft komplett im Renderer (Canvas). NDI-Quelle: „+ NDI" → suchen → verbinden.

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
