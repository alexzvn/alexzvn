---
id: livestream-tricaster-ptz
title: "Livestream-Setup: TriCaster + PTZ-Kameras"
category: Technik-Setups
difficulty: mittel
setupTimeMin: 240
teamSize: "2-3"
tags: [livestream, tricaster, ptz, ndi, regie]
relatedTools: [jm-switcher, jm-caption, jm-titler, jm-stage-display]
prerequisites:
  - Strom 230 V / 10 A, einzeln abgesichert
  - DSL-/Upload-Zugang vom Kunden
  - Raumzugang am Aufbau- und am Showtag
equipmentOwner: jm
crewRoles:
  - Regie
  - Media Operator Video (TriCaster)
  - Media Operator Audio
lastReviewed: 2026-06-24
owner: tech@jakobsmedien.com
summary: "Kompaktes, mehrkamerataugliches Livestream-Setup mit TriCaster-Regie, PTZ-Kameras und DSGVO-konformem Stream — Basis für hybride Veranstaltungen."
---

## Zutaten

### Regie & Zuspielung
- NewTek TriCaster TC2 Elite (Broadcasting-System)
- 2x Regie-Laptop (Programm-Feeds und Layouts)
- 2-Wege-Intercom (z. B. GreenGo: Beltpacks, Antenne, Tischstation)

### Kamera
- 3x PTZ-Kamera (z. B. Panasonic AW-UE150) inkl. Stativ + 20 m Verkabelung
- PTZ-Bedienpanel (z. B. AW-RP150)
- FlexTally für Kamera-Tally
- Kamerapodest

### Stream & Netzwerk
- DSGVO-Livestream (Server-Standort Deutschland)
- Livetranscoding (pro Stunde abgerechnet)
- Aufzeichnung → Video-on-Demand

### Infrastruktur
- Regieverkleidung (Pipes & Drapes)
- Verkabelungspauschalen Video / Audio / Strom / Netzwerk
- Kabelkanäle (Defender)

## Schritt-für-Schritt

### Vorbereitung
- Transport und Aufbau am Vortag
- PTZ-Positionen und Bildausschnitte einrichten
- TriCaster-Szenen/Layouts anlegen
- Intercom-Funkstrecken einmessen
- Stream-Endpunkt + Transcoding testen
- Abnahme und Probe mit Programm

### Während
- Live-Regie steuert Szenen und Layouts
- Backstage-Kommunikation über 2-Wege-Intercom
- Recording für VOD mitlaufen lassen
- Stream-Gesundheit (Bitrate, Drops) überwachen

### Nachbereitung
- Aufzeichnung sichern
- VOD bereitstellen
- Abbau und Restabbau
- Material für Postproduktion übergeben

## Profi-Tipps
- Mehr Kamerabewegung und Inserts halten den Stream dynamisch — statische Totalen wirken schnell langweilig.
- Vorhandene Haustechnik (Licht, LED-Wand, Audiopult) vorab auf Verfügbarkeit und Funktion prüfen — nicht blind aufs Inventar verlassen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Kundeninternet instabil / ohne Haftung | Mobiler Backup-Uplink (Bonding/LTE), Stream-Bitrate konservativ wählen |
| PTZ-Kamera reagiert nicht | Netzwerk/PoE prüfen, Ersatz-Patch, Kamera am Panel neu zuweisen |
| Tally fehlt oder ist falsch | FlexTally-Zuordnung im TriCaster prüfen |
| Intercom-Aussetzer | Antennenposition/Frequenz prüfen, Beltpack-Akkus tauschen |

## Checklisten

### Aufbau
- [ ] Strom 230 V / 10 A abgesichert
- [ ] Netzwerk / Upload steht
- [ ] PTZ-Kameras zugewiesen und getallyt
- [ ] TriCaster-Layouts angelegt
- [ ] Intercom eingemessen

### Vor Sendung
- [ ] Stream-Endpunkt live getestet
- [ ] Recording armiert
- [ ] Backup-Uplink bereit
- [ ] Probe mit Regie gelaufen
