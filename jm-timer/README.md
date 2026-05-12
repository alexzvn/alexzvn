# JM Timer

Live-Produktions-Timer für Jakobs Medien GmbH. Electron-Desktop-App mit Clock, Countdown, Timetable (folgt) und anpassbaren Timer-Farben — gebaut nach dem JM Design Guide.

## Stack

- Electron + Vite + React 18 + TypeScript
- Tailwind v4 (`@tailwindcss/vite`)
- Zustand für State + persist
- Manrope (Variable Font, lokal via `@fontsource-variable/manrope`)
- `electron-vite` als Dev-Toolchain

## Quick Start

```bash
cd jm-timer
npm install
npm run dev
```

`npm run dev` startet Vite + Electron mit Hot-Reload.

## Builds

```bash
npm run build       # bundles main, preload, renderer
npm run package     # zusätzlich electron-builder (Win/Mac-Installer)
npm run typecheck   # tsc check für node + web
```

## Was ist drin (Phase 1+2)

- AppShell mit Sidebar (Clock / Countdown / Timetable / Farben) + Topbar mit Dark-/Light-Toggle
- **Clock-View**: Real-Time HH:MM:SS mit Datum
- **Countdown-View**: HH:MM:SS-Eingabe, Quick-Presets, Start/Pause/Resume/Reset, Live-Farbwechsel auf Warning/Overtime, Keyboard-Shortcuts (Space = Start/Pause, R = Reset)
- **Live-Delay**: Während des laufenden Timers Verspätung (oder Aufholzeit) in Sekunden eintragen — Quick-Buttons (±30 s / ±1 min / ±5 min) oder freier Wert. Timer verlängert/verkürzt sich sofort, projizierte **Endzeit** (Wall-Clock) wird live unter dem Display angezeigt, Delay-Pill zeigt Summe an. Delay wird beim `Reset` und beim Setzen einer neuen Dauer automatisch geleert.
- **Color-Picker**: Normal / Warning / Overtime + Schwellenwert, mit Live-Preview, JM-Defaults zurücksetzbar
- State wird per `zustand/persist` zwischen Sessions erhalten (Farben + zuletzt eingestellte Dauer)
- JM-Design-Tokens 1:1 aus dem Design Guide (§2.4)

## Was folgt (Phase 3+)

- **Speaker-Window** (Fullscreen auf 2. Display)
- **Socket.IO-Sync** (Operator ↔ Speaker ↔ Remote-Browser im LAN)
- **Remote-View** (Browser-basiert, gleicher Look)
- **Timetable** mit XLSX-Import + manueller Pflege
- **Installer** via `electron-builder`

## Logo

`src/renderer/src/assets/jm-logo.svg` ist ein Form-Platzhalter. Tausche die Datei gegen die offizielle
`JM Logo_gelb-01.svg` aus eurer CI-Ablage (`Marketing Space/Corporate Identy/Jakobs Medien GmbH/Logos/SVG/`) — die App lädt automatisch die neue Version (Vite löst den Import auf).

## Projektstruktur

```
jm-timer/
├── electron.vite.config.ts
├── package.json
├── tsconfig*.json
├── src/
│   ├── main/index.ts            # Electron main, Window-Mgmt
│   ├── preload/index.ts         # IPC-Bridge (minimal, ausgebaut in Phase 3)
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── globals.css
│           ├── tokens/
│           │   ├── colors.css        # JM Design Guide §2.4
│           │   └── typography.css    # JM Design Guide §3
│           ├── assets/
│           │   └── jm-logo.svg
│           ├── components/
│           │   ├── AppShell.tsx
│           │   ├── Sidebar.tsx
│           │   ├── Topbar.tsx
│           │   ├── Logo.tsx
│           │   ├── Clock.tsx
│           │   ├── Countdown.tsx
│           │   ├── ColorPicker.tsx
│           │   ├── TimerDisplay.tsx
│           │   └── ui/                # JM-Primitives
│           │       ├── Button.tsx
│           │       ├── Card.tsx
│           │       ├── Headline.tsx
│           │       ├── Input.tsx
│           │       ├── SectionHeader.tsx
│           │       └── StatusPill.tsx
│           ├── views/Timetable.tsx
│           ├── store/timer.ts
│           └── lib/{cn,time,useTick}.ts
└── resources/                   # später für Icons / Installer-Assets
```

## Keyboard-Shortcuts (Countdown)

| Taste | Aktion |
|---|---|
| Space | Start / Pause (Toggle) |
| R     | Reset |
