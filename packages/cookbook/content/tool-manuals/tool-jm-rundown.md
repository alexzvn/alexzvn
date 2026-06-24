---
id: tool-jm-rundown
title: "JM Rundown — Ablaufregie einrichten"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 30
teamSize: "1"
tags: [rundown, ablauf, regie, companion, mdns, manual]
relatedTools: [jm-rundown, jm-timer, jm-prompter, jm-presenter, jm-titler, jm-switcher]
prerequisites:
  - JM Rundown installiert (über den Launcher)
  - Die anzusteuernden Tools im selben LAN (werden per mDNS gefunden)
  - Optional: Bitfocus Companion für Fern-GO
equipmentOwner: jm
crewRoles:
  - Regie / Ablaufregie
lastReviewed: 2026-06-24
owner: tech@jakobsmedien.com
summary: "Zeilenbasierter Ablaufplan: ein GO startet pro Segment mehrere Tools gleichzeitig (Timer, Prompter, Presenter, Titler, Switcher)."
---

## Zutaten

### Voraussetzungen
- JM Rundown installiert (über den Launcher)
- Ziel-Tools im selben LAN gestartet (Timer, Prompter, Presenter, Titler, Switcher)
- Optional: Bitfocus Companion für Fern-GO

### Was pro Segment gesteuert wird
- Timer-Block (JM Timer)
- Prompter-Skript (JM Prompter)
- Presenter-Folie (JM Presenter)
- Titler-Bauchbinde (JM Titler)
- Switcher-Szene (JM Switcher)

## Schritt-für-Schritt

### Einrichtung
- Ziel-Tools starten, damit JM Rundown sie per mDNS findet
- Rundown-Zeilen je Segment anlegen und die Aktionen pro Zeile zuordnen
- Live-Status der gefundenen Tools prüfen
- Optional: Bitfocus Companion für Fern-GO verbinden
- Als `.jmrundown` speichern

### Während
- Pro Segment GO drücken — feuert alle zugeordneten Aktionen gleichzeitig
- Live-Status / Tally im Blick behalten
- Bei Bedarf einzelne Aktionen per Override anpassen

### Nachbereitung
- `.jmrundown` sichern

## Profi-Tipps
- Tools vor der Probe starten, damit sie im mDNS auftauchen und zuweisbar sind.
- Pro Zeile nur die wirklich nötigen Aktionen — das hält das GO vorhersehbar.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Tool wird nicht gefunden | Gleiches Subnetz prüfen, Tool gestartet?, mDNS/Firewall |
| GO feuert nicht alle Aktionen | Zuordnung je Zeile kontrollieren |
| Companion-GO ohne Wirkung | Verbindung und gemeinsames LAN prüfen |

## Checklisten

### Einrichtung
- [ ] Ziel-Tools laufen und sind gefunden
- [ ] Zeilen und Aktionen angelegt
- [ ] Live-Status grün
- [ ] Als .jmrundown gespeichert

### Vor Live
- [ ] Probe-GO je Segment gelaufen
- [ ] Companion (optional) getestet
