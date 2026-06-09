# JM Switcher — Bitfocus Companion Module

Steuert den [JM Switcher](../../apps/switcher) über das geteilte TCP-Zeilenprotokoll
[@jm/companion-protocol](../companion-protocol). Damit lässt sich der Switcher per
Stream Deck / Companion bedienen.

## Einrichten
1. Im JM Switcher: Tab **Einstellungen → Fernsteuerung** aktivieren, Port merken
   (Standard **8723**).
2. In Companion dieses Modul hinzufügen, **Switcher-IP** (Rechner, auf dem der
   Switcher läuft) + **Port** eintragen.

## Aktionen
- **Preview-Szene wählen** / **Program-Szene (harter Schnitt)** — Szene per Nummer (1-basiert)
- **Cut** (Program = Preview) · **Auto** (Dissolve, optional ms)
- **Aufnahme** Start/Stopp/Umschalten · **Stream (RTMP)** Start/Stopp/Umschalten

## Feedbacks (Tastenfarbe)
- Szene ist auf **Program** (rot) / **Preview** (grün)
- **Aufnahme läuft** (rot) · **Stream läuft** (gelb)

## Variablen
`program`, `preview` (Szenen-Nr.), `recording`, `streaming` (an/aus), `scenes` (Anzahl).

## Presets
Cut/Auto/Rec/Stream + Preview/Program für Szene 1–4.

## Bauen / Verteilen
Dieses Modul ist **eigenständig** (kein npm-Workspace-Mitglied — sonst zöge der
Companion-Toolchain-Baum den Suite-Install unnötig auf). Der Protokoll-Client ist
in `main.js` inline gespiegelt (Quelle der Wahrheit bleibt
[@jm/companion-protocol](../companion-protocol), das der Switcher selbst nutzt).
```bash
cd packages/companion-jm-switcher
npm install          # nur die Modul-eigenen Deps
npx companion-module-build
```
Das erzeugte Paket in Companions Modul-Ordner (Developer modules path) ablegen.

> Hinweis: Das Modul folgt der Companion-v3-API (`runtime.type: node22`,
> `nodejs-ipc`). Es wurde gegen das Protokoll entwickelt; der finale Test in einer
> Companion-Installation steht beim Anwender aus.
