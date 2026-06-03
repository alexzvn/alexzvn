# JM Sync

A/V-Versatz-Messung (Lipsync) für Live-Streaming — Softwareersatz für das
**Sync-It-Plus**. Teil der JM Production Suite.

## Prinzip

Es braucht **keine** synchronisierten Uhren zwischen Quelle und Messpunkt:

1. **Generator** löst Blitz + Piep exakt **gleichzeitig** aus (digitales
   Klappenbrett) und schickt sie durch die Streaming-Pipeline.
2. **Messung** erfasst beide Signale mit **einer** Uhr. Die gemessene Differenz
   Blitz↔Piep ist der A/V-Versatz, den die Pipeline eingebaut hat.

Messquellen: **Handy-Kamera + Mikro** (PWA, robustestes Prinzip) sowie
**Capture-Card + Audio-Interface** (Electron, fürs Studio). Beide werden als
normaler `MediaStream` konsumiert — ein Messpfad für beide.

## Stack

Wie die übrige Suite: Electron + electron-vite + React + Tailwind + Zustand +
Manrope. Eine Codebasis, zwei Ziele:

- **Electron-Hülle** (`src/main`, `src/preload`) — Desktop/Studio.
- **PWA-Build** (`vite.web.config.ts` → `dist-web/`) — Handy. Braucht in
  Produktion HTTPS-Hosting für den Kamerazugriff.

Plattformspezifisches läuft über [`src/renderer/src/platform.ts`](src/renderer/src/platform.ts);
die Mess-Engine liegt framework-neutral unter [`src/renderer/src/core/`](src/renderer/src/core/).

## Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Electron-App im Dev-Modus (Port 5177) |
| `npm run dev:web` | PWA im Dev-Modus (Port 5187) |
| `npm run build` | Electron-Build (`out/`) |
| `npm run build:web` | PWA-Build (`dist-web/`) |
| `npm run typecheck` | Typecheck (node + web) |
| `npm run dist:win` / `dist:mac` | Installer bauen |
| `npm run start:codespace` | Headless-Start unter xvfb |

## Status

**Phase 0 — Scaffold (fertig):** lauffähige Hülle in Suite-Optik, Tabs
*Messung · Generator · Kalibrierung* (Platzhalter), Plattform-Adapter, beide
Build-Ziele grün.

Nächste Phasen: **1** Mess-Engine (Blitz-/Piep-Erkennung + Korrelator) ·
**2** Generator + Null-Abgleich + Statistik · **3** Geräteauswahl, Politur,
Installer + PWA-Hosting.
