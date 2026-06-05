# JM Copy

Verifizierter Offload für die **JM Production Suite**. Kopiert Footage von Karte/Quelle
auf ein oder mehrere Ziele, prüft jede Datei per **xxHash64**, schreibt ein
**MHL-Protokoll** und legt alles in einen frei konfigurierbaren **Master-Ordner** ab.

## Funktionen

- **Verifiziertes Kopieren** – Quelle einmal lesen, parallel auf mehrere Ziele
  schreiben, jedes Ziel zurücklesen und die Prüfsumme vergleichen.
- **xxHash64** (schnell, Hedge/Silverstack-Standard), optional zusätzlich **MD5**.
- **MHL-Sidecar** (MHL 1.1, `<xxhash64be>`) pro Ziel – lesbar von DaVinci Resolve,
  Silverstack, ShotPut Pro u. a.
- **Master-Ordner-Baukasten** – Vorlagen aus Tokens für Datum/Zeit
  (`{YYYY} {MM} {DD} {HH} {date} …`), Projekt/Produktion
  (`{projekt} {kunde} {produktion} {episode} {shootday}`) und festen
  Unterordnern (`Footage`, `Audio`, `Docs`, …).
- **Prüfen** – bestehenden Ordner jederzeit erneut gegen sein MHL verifizieren.

## Architektur

Electron + electron-vite, React 18 + Zustand, Tailwind v4 – identisch zur restlichen
Suite. Die Template-Engine liegt in `src/shared/template.ts` und wird von Renderer
(Live-Vorschau) **und** Copy-Job (erzeugter Ordner) genutzt, damit Vorschau und
Ergebnis exakt übereinstimmen.

```
src/
  shared/      types.ts, template.ts          (geteilt, rein, getestet)
  main/
    copy/      hash.ts  scan.ts  engine.ts     (kopieren + verifizieren)
               mhl.ts   verify.ts              (MHL schreiben/lesen, Re-Verify)
    ipc.ts  index.ts
  preload/     index.ts                        (window.jmcp Bridge)
  renderer/    Views: CopyView · TemplatesView · VerifyView
```

## Entwicklung

```bash
npm install
npm run dev               # Electron + Vite (Renderer-Port 5178)
npm run typecheck         # node + web
npm test                  # Vitest (template, mhl, hash)
npm run build             # Production-Build nach out/
npm run dist:win          # NSIS-Installer (Windows)
npm run dist:mac          # DMG (macOS, arm64 + x64)
```

In GitHub Codespaces ohne Display:

```bash
npm run build && npm run start:codespace   # läuft via xvfb
```
