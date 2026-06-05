# JM Timer

Live-Produktions-Timer für Jakobs Medien GmbH. Electron-Desktop-App mit Operator-, Speaker- und LAN-Remote-View, Clock, Countdown, Timetable mit XLSX-Import, Live-Delay, Live-Nachricht — gebaut nach dem JM Design Guide.

## Stack

- Electron + Vite + React 18 + TypeScript
- Tailwind v4 (`@tailwindcss/vite`)
- Zustand für lokalen Renderer-State
- Socket.IO für Operator/Speaker/Remote-Sync (authoritative State im Main-Prozess)
- SheetJS (`xlsx`) für Regieplan-Import — **lazy** geladen
- Manrope (Variable Font, lokal via `@fontsource-variable/manrope`)
- `electron-vite` als Dev-Toolchain, `electron-builder` für Installer

## Quick Start

```bash
cd jm-timer
npm install
npm run dev
```

## Builds & Distribution

```bash
npm run build              # bundles main + preload + renderer
npm run typecheck          # tsc check für node + web

npm run dist               # baut + electron-builder (alle Plattformen)
npm run dist:mac           # nur macOS (DMG + ZIP, arm64 + x64)
npm run dist:win           # nur Windows (NSIS Installer)
npm run dist:linux         # nur Linux (AppImage + deb)
npm run dist:dir           # unpacked dir zum Testen ohne Installer
```

Installer-Ausgabe landet in `release/`. Code-Signing ist deaktiviert (Mac
`hardenedRuntime: false`) — für Notarisierung muss das vor einem Public-Release
aktiviert + ein Apple Developer Certificate hinterlegt werden.

App-Icons sind optional vorgesehen unter `build/icon.{icns,ico,png}` — derzeit
nutzt der Build das Electron-Default-Icon.

## Features (Phase 1–6)

### Modi & Views
- **Operator-Window**: Steuerzentrale mit Sidebar (Clock / Countdown / Timetable / Remote / Farben) + Topbar + persistenter MessageBar.
- **Speaker-Window**: Fullscreen auf 2. Display, zeigt automatisch Countdown wenn aktiv, sonst Real-Time-Clock. Logo, Sync-Indikator, Plan-Dauer, projizierte Endzeit, aktiver Programmpunkt + „Up Next", Live-Nachricht (optional blinkend).
- **Remote-View (LAN-Browser)**: gleicher Look wie Speaker, läuft auf jedem Gerät im LAN (iPad, Smartphone, Backstage-Monitor). Read-Only-Spiegel. URL: `http://<host-ip>:7777/?view=remote` in Production, `http://<host-ip>:5173/?view=remote` im Dev-Modus. Operator-Sidebar „Remote" zeigt die kopierbaren URLs.

### Timer-Funktionen
- **Clock**: Real-Time HH:MM:SS mit Datum.
- **Countdown**: HH:MM:SS-Eingabe, Quick-Presets, Start/Pause/Resume/Reset, Live-Farbwechsel auf Warning/Overtime, Keyboard-Shortcuts (Space = Start/Pause, R = Reset).
- **Live-Delay**: Verspätung (oder Aufholzeit) in **Sekunden** live eintragen — Quick-Buttons (±30 s / ±1 min / ±5 min) oder freier Wert. Timer und projizierte Endzeit reagieren sofort. Delay-Pill zeigt die Summe an. Wird beim `Reset` und beim Setzen einer neuen Dauer geleert.
- **Color-Picker**: Normal / Warning / Overtime + Schwellenwert frei einstellbar, mit Live-Preview, JM-Defaults zurücksetzbar.

### Timetable
- **Manuelles Anlegen**: Add-Button, Inline-Edit (Titel/Dauer/Notiz), Up/Down-Buttons zum Verschieben, Delete.
- **XLSX-Import**: SheetJS-basiert, **lazy geladen** (~700 KB nur bei Bedarf). Spalten Titel/Dauer/Notiz werden heuristisch erkannt; Dauer akzeptiert `HH:MM:SS`, `MM:SS`, Excel-Time-Fraction, Date-Objekt oder Zahl in Minuten. Preview-Modal mit erkannten Spalten, Item-Count, Gesamtdauer, Toggle „Ersetzen ↔ Anhängen".
- **Live-Show-Card**: aktiver Programmpunkt mit großem TimerDisplay, Prev/Next-Buttons, integrierter DelayControls, Up-Next-Hinweis.
- **Projizierte Schedule**: Für jedes nachfolgende Item wird die Wall-Clock-Startzeit live berechnet (Cascading) — Delay schiebt automatisch alle Folge-Items nach hinten.
- **Persistierung**: Items werden in `userData/state.json` gespeichert, `activeIndex` ist session-lokal.

### Live-Nachricht
- MessageBar in der Operator-AppShell (sichtbar in jedem Mode). Text + Senden + Blink-Toggle + Leeren.
- Auf Speaker + Remote unterhalb des Timers groß angezeigt, mit hartem On/Off-Blink (~1 Hz) wenn aktiviert.

### Sync-Architektur
- **Authoritative State** im Main-Prozess (single source of truth), persistiert nach `userData/state.json`.
- **Socket.IO** auf `0.0.0.0:7777` — Operator und Speaker im selben Electron-Prozess, Remote-Browser im LAN nutzen denselben Endpoint.
- **Auto-Reconnect** bei Verbindungsverlust, Sync-Indikator auf Operator + Speaker.
- **Smart-URL-Resolution**: Renderer im Electron nutzt Preload-API (`window.jm.serverUrl`), im Browser leitet er die URL aus `window.location.hostname` ab.

## Architektur

```
┌────────────────────────────────────────────────┐
│ Electron Main Process                          │
│ ├─ socket.io + http :7777 (0.0.0.0)           │
│ ├─ authoritative SyncedState                  │
│ ├─ persistence → userData/state.json          │
│ └─ window manager (Operator + Speaker)        │
└──┬──────────────────────────────────────────────┘
   │ socket.io
   ├─► Operator-Window  → Steuerung, Edit, Import
   ├─► Speaker-Window   → Fullscreen, read-only
   └─► Browser im LAN   → Remote-View (=Speaker im Browser)
```

## Sicherheitshinweis

Aktuell keine Authentifizierung. Im selben LAN kann jeder Client sich verbinden
und (wenn er den Command-Channel kennt) Befehle senden. Für Public-Wifi-Setups
bitte über Firewall absichern oder Token-Auth nachrüsten.

## Logo

`src/renderer/src/assets/jm-logo.svg` ist ein Form-Platzhalter. Tausche die Datei
gegen die offizielle `JM Logo_gelb-01.svg` aus eurer CI-Ablage —
Vite löst den Import automatisch neu auf.

## Stand der Phasen

| Phase | Status |
|---|---|
| 1. Foundation + AppShell + Tokens | ✓ |
| 2. Clock + Countdown + ColorPicker + Persistenz | ✓ |
| 2.5 Live-Delay (Sekunden) | ✓ |
| 3. Speaker-Window + Socket-Sync | ✓ |
| 4. Remote-View (LAN-Browser) + RemoteInfo | ✓ |
| 5. Timetable + XLSX-Import + Cascading | ✓ |
| 5.5 Live-Nachricht + Blink | ✓ |
| 6. electron-builder Config (Win/Mac/Linux) | ✓ |
| 7. Auto-Advance (optional, später) | offen |
| 8. PDF-Import + Spalten-Mapping-UI | offen |
| 9. Code-Signing + Notarisierung + Icons | offen |
| 10. Token-Auth für Remote | offen |

## Projektstruktur

```
jm-timer/
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig*.json
├── src/
│   ├── shared/timer-state.ts        # Reducer + Typen (Main + Renderer)
│   ├── main/
│   │   ├── index.ts                 # Window-Mgmt + IPC
│   │   ├── state.ts                 # Authoritative State + Persistenz
│   │   └── server.ts                # Socket.IO + HTTP static
│   ├── preload/index.ts             # IPC-Bridge → window.jm
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx              # View routing (operator/speaker/remote)
│           ├── main.tsx
│           ├── globals.css
│           ├── tokens/
│           ├── assets/jm-logo.svg
│           ├── store/timer.ts
│           ├── sync/
│           │   ├── client.ts        # Socket-Client + URL-Resolver
│           │   └── jm.d.ts
│           ├── lib/{cn,time,useTick,xlsx}.ts
│           ├── views/
│           │   ├── Operator.tsx
│           │   └── Speaker.tsx
│           └── components/
│               ├── AppShell.tsx
│               ├── Sidebar.tsx
│               ├── Topbar.tsx
│               ├── MessageBar.tsx
│               ├── Logo.tsx
│               ├── Clock.tsx
│               ├── Countdown.tsx
│               ├── DelayControls.tsx
│               ├── ColorPicker.tsx
│               ├── TimerDisplay.tsx
│               ├── Timetable.tsx
│               ├── TimetableRow.tsx
│               ├── XlsxImport.tsx
│               ├── RemoteInfo.tsx
│               └── ui/
│                   ├── Button.tsx
│                   ├── Card.tsx
│                   ├── Headline.tsx
│                   ├── Input.tsx
│                   ├── SectionHeader.tsx
│                   └── StatusPill.tsx
└── release/                          # electron-builder Output (gitignored)
```

## Keyboard-Shortcuts (Countdown)

| Taste | Aktion |
|---|---|
| Space | Start / Pause (Toggle) |
| R     | Reset |
