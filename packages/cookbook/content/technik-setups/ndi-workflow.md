---
id: ndi-workflow
title: "NDI-Workflow im Studio-LAN"
category: Technik-Setups
difficulty: mittel
setupTimeMin: 60
teamSize: "1"
tags: [ndi, netzwerk, studio, mdns, bandbreite]
relatedTools: [jm-ndi-screen-capture, jm-switcher, jm-titler, jm-caption, jm-studio-control]
prerequisites:
  - Gigabit-LAN (möglichst dediziertes Produktions-Netz/VLAN)
  - NDI-Runtime auf den beteiligten Rechnern
  - Gleiche Subnetze für die Discovery
equipmentOwner: jm
crewRoles:
  - Media Operator / Netzwerk
lastReviewed: 2026-06-24
owner: tech@jakobsmedien.com
summary: "NDI-Quellen sauber im Studio-LAN bereitstellen und einbinden — Benennung, Bandbreite, Discovery und typische Fallstricke."
---

## Zutaten

### Netzwerk
- Gigabit-Switch, möglichst dediziertes NDI-/Produktions-VLAN
- Gleiche Subnetze für mDNS-Discovery

### Quellen
- JM NDI Screen Capture (Bildschirm/Fenster)
- JM Titler (transparente Grafik), JM Caption (Untertitel)
- Kameras/Encoder mit NDI

### Senken
- Bildmischer (TriCaster / vMix / OBS / JM Switcher)

## Schritt-für-Schritt

### Vorbereitung
- Geräte ins gleiche Subnetz bringen, NDI-Runtime sicherstellen
- Quellen klar benennen (Gerät + Inhalt)
- Bandbreite grob kalkulieren (Full-NDI vs. NDI-HX)

### Während
- Quellen im Mixer einbinden
- Auf Latenz und Framedrops achten
- Netzwerklast beobachten

### Nachbereitung
- Benennungs-/Portplan für die nächste Show dokumentieren

## Profi-Tipps
- Eindeutige, sprechende NDI-Namen sparen im Live-Betrieb viel Zeit.
- Für viele Full-NDI-Streams das Netz dimensionieren oder gezielt NDI-HX nutzen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Quelle nicht sichtbar | Gleiches Subnetz/mDNS, Firewall, NDI-Runtime prüfen |
| Ruckler / Drops | Bandbreite/Switch prüfen, NDI-HX erwägen |
| Hohe Latenz | Netzlast und CPU der Quelle prüfen |

## Checklisten

### Aufbau
- [ ] Gleiches Subnetz
- [ ] NDI-Runtime vorhanden
- [ ] Quellen sprechend benannt
- [ ] Bandbreite geprüft

### Vor Live
- [ ] Alle Quellen im Mixer sichtbar
- [ ] Keine Drops/Latenzprobleme
