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
Das Modul nutzt `@companion-module/base`. Zum Paketieren für Companion:
```bash
npm install        # im Monorepo-Root (verlinkt @jm/companion-protocol)
cd packages/companion-jm-switcher
npx companion-module-build      # bündelt inkl. @jm/companion-protocol → pkg
```
Das erzeugte Paket in Companions Modul-Ordner (Developer modules path) ablegen.

> Hinweis: Das Modul folgt der Companion-v3-API (`runtime.type: node22`,
> `nodejs-ipc`). Es wurde gegen das Protokoll entwickelt; der finale Test in einer
> Companion-Installation steht beim Anwender aus.
