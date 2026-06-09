# JM Presenter

PDF-Presenter und Folien-Editor für die **JM Production Suite**. Bereitet
PDF-, Bild- und Office-Dateien zu einer sauberen Präsentation auf und spielt sie
mit getrennter **Referenten-** und **Publikumsansicht** über zwei Bildschirme aus.

## Funktionen

- **Import** – PDF, Bilder (PNG/JPG/WebP) und Office-Dokumente (PPTX/DOCX/ODP …).
  Office wird über ein lokal installiertes **LibreOffice** nach PDF konvertiert
  (gleiche Technik wie JM Media Converter; ohne LibreOffice gibt es einen Hinweis).
- **Editor** – Folien per Drag neu anordnen, aus-/einblenden, duplizieren, löschen.
  Titel und **Sprecher-Notizen** je Folie. Einfache **Text- und Logo-Overlays**
  (verschieben, skalieren, Schrift/Farbe/Ausrichtung, Balken-Hintergrund).
- **Projekt** – Speichern als selbst-enthaltenes `.jmpres` (ZIP mit Manifest +
  Originaldateien) und jederzeit wieder öffnen.
- **PDF-Export** – sichtbare Folien inkl. eingebrannter Overlays in eine neue PDF.
- **Präsentationsmodus**
  - **Referentenansicht**: aktuelle + nächste Folie, Notizen, Folienzähler
    (aktuell / max), **Uhr + Laufzeit-Timer**, **Folienübersicht (Grid)** und
    **„Gehe zu Folie"**.
  - **Publikumsansicht**: nur die aktuelle Folie, formatfüllend auf Schwarz.
  - **Freie Bildschirm-Zuweisung** des Publikumsfensters, Vollbild-Umschaltung.
  - Steuerung per Tastatur/Maus und **USB-Presenter-Clicker** (PageUp/PageDown,
    Pfeiltasten, Leertaste; `Esc` beendet).

## Architektur

Electron + electron-vite, React 18 + Zustand, Tailwind v4 – identisch zur
restlichen Suite. Die **Multi-Window-Logik** (zweites Fenster, Display-Erkennung,
Vollbild) folgt dem Muster von JM Timer; alle drei Ansichten teilen sich eine
Renderer-Bundle und werden per `?view=`-Query geladen.

Der Präsentationszustand (aktuelle Folie) lebt im **Main-Prozess** und wird per
IPC an Referenten- und Publikumsfenster gebroadcastet – beide Renderer bleiben so
immer synchron. Der **Slide-Compositor** (`lib/paint.ts`) ist die einzige Quelle
für das Aussehen einer Folie und wird von Publikumsansicht, Referenten-Previews
**und** PDF-Export genutzt, damit Editor, Bühne und Export identisch aussehen.

```
src/
  shared/      types.ts                          (geteilte Domänen-/IPC-Typen)
  main/
    windows.ts present.ts                         (3 Fenster, Display-Zuweisung, Sync-Hub)
    office/    locate.ts  convert.ts              (LibreOffice → PDF)
    ipc.ts  index.ts
  preload/     index.ts                           (window.jmpr Bridge, ?view-Parsing)
  renderer/
    lib/       pdf.ts  paint.ts  project-file.ts  export-pdf.ts  assets.ts …
    store/     project.ts                         (Editor-Zustand, Zustand)
    views/     EditorView · PresenterView · AudienceView
```

## Entwicklung

```bash
npm install
npm run dev               # Electron + Vite (Renderer-Port 5179)
npm run typecheck         # node + web
npm run build             # Production-Build nach out/
npm run dist:win          # NSIS-Installer (Windows)
npm run dist:mac          # DMG (macOS, arm64 + x64)
```

In GitHub Codespaces ohne Display:

```bash
npm run build && npm run start:codespace   # läuft via xvfb
```

> **Hinweis:** Office-Import benötigt ein installiertes LibreOffice auf dem
> Zielrechner. Der Präsentationsmodus entfaltet seinen Nutzen mit zwei
> Bildschirmen; mit nur einem Display überlagern sich Referenten- und
> Publikumsfenster (Vollbild).
