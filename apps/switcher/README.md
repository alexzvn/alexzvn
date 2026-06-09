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
- **Slice 2 (geplant):** **NDI-Empfang** als Quelle (packages/ndi RECEIVE ist schon
  da) — Frames im utilityProcess pollen, per Kopie an den Renderer-Compositor
  (Copy-not-transfer-Disziplin aus der NDI Screen Capture).
- **Slice 3:** eine **Capture-Karte** (ffmpeg dshow) als Quelle.
- **Slice 4:** **Aufnahme** (ffmpeg) + **RTMP**-Ausgabe des Program-Outputs.
- **Slice 5:** **TCP-Steuerserver** + **@jm/companion-protocol** + Bitfocus-
  **Companion-Modul** (`packages/companion-jm-switcher`): PREVIEW/PROGRAM/CUT/
  AUTO/RECORD/STREAM + State-Feedback.

ATEM-Hardware-Steuerung, SRT, mehrere Karten, Keying/PiP, Audio-Mischmatrix =
v0.2+.

## Entwicklung
```bash
npm run dev -w @jm/switcher
npm run typecheck -w @jm/switcher
```
Bildschirmquelle: „+ Bildschirm" wählt einen Monitor/ein Fenster; das Compositing
läuft komplett im Renderer (Canvas). NDI/Karte/Record/RTMP kommen in den nächsten
Slices dazu.
