---
id: tool-jm-studio-control
title: "JM Studio Control — Studio & TriCaster steuern"
category: Tool-Manuals
difficulty: anspruchsvoll
setupTimeMin: 45
teamSize: "1"
tags: [studio-control, tricaster, atem, obs, ptz, companion, gateway, manual]
relatedTools: [jm-studio-control, jm-switcher, jm-stage-display]
prerequisites:
  - JM Studio Control installiert (über den Launcher)
  - Studiogeräte im Netz erreichbar (TriCaster, ATEM, OBS, PTZ, Audio/Licht)
  - Nutzer und Rollen festgelegt
  - Optional: Bitfocus Companion (Gateway-Rolle "studio")
equipmentOwner: gemischt
crewRoles:
  - Studio-Operator / Technische Leitung
lastReviewed: 2026-06-24
owner: tech@jakobsmedien.com
summary: "Zentrale Studiosteuerung (TriCaster/ATEM/OBS/PTZ/Audio/Licht) mit Nutzerrollen, NDI-PGM-Vorschau und Companion-Gateway."
---

## Zutaten

### Voraussetzungen
- JM Studio Control (über den Launcher)
- Erreichbare Studiogeräte: Video-Mischer (TriCaster/ATEM/OBS), PTZ-Kameras, Audio, Licht
- Nutzer und Rollen
- Optional: Bitfocus Companion über die Gateway-Rolle „studio"

### Gewerke
- Video-Mischer (TriCaster / ATEM / OBS)
- PTZ-Kameras
- Audio und Licht

## Schritt-für-Schritt

### Einrichtung
- Geräte verbinden und je Typ eine Primär-Instanz festlegen
- Nutzer und Rollen anlegen (wer darf was)
- NDI-PGM-Vorschau einrichten
- Optional: Companion-Gateway aktivieren (typ-präfixierte Verben für ATEM/OBS/TriCaster/PTZ/Audio/Licht)

### Während
- Quellen und Szenen schalten, PTZ steuern, Audio/Licht bedienen
- PGM-Vorschau im Blick behalten
- Aktionen werden zentral protokolliert (auditiert)

### Nachbereitung
- Session/Logs sichern

## Profi-Tipps
- Pro Gerätetyp genau eine Primär-Instanz festlegen — das vermeidet Mehrdeutigkeit beim Schalten.
- Das Companion-Gateway bündelt alle Gewerke auf einer Rolle, statt jedes Gerät einzeln anzubinden.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Gerät nicht erreichbar | Netz/IP und Anmeldedaten prüfen |
| Verb wirkt nicht | Richtige Primär-Instanz und Typ-Präfix prüfen |
| Aktion verweigert | Nutzerrolle/Rechte kontrollieren |

## Checklisten

### Einrichtung
- [ ] Geräte verbunden (Primär-Instanz je Typ)
- [ ] Rollen gesetzt
- [ ] PGM-Vorschau läuft
- [ ] Companion-Gateway (optional) aktiv

### Vor Live
- [ ] Schalt-Test je Gewerk gelaufen
- [ ] Rechte/Rollen geprüft
