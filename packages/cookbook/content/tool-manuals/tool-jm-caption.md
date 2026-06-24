---
id: tool-jm-caption
title: "JM Caption — Live-Untertitel (NDI) einrichten"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 20
teamSize: "1"
tags: [caption, untertitel, ndi, whisper, barrierefreiheit, bitv, manual]
relatedTools: [jm-caption, jm-switcher, jm-studio-control]
prerequisites:
  - Windows mit installierter NDI-Runtime
  - JM Caption installiert (über den Launcher)
  - Audioeingang (Mikrofon oder Saal-/Stream-Mix)
  - Whisper-Modell (Basismodell mitgeliefert, größere nachladbar)
equipmentOwner: jm
crewRoles:
  - Media Operator (Untertitel)
lastReviewed: 2026-06-24
owner: tech@jakobsmedien.com
summary: "Live-Untertitel offline via whisper.cpp als transparente NDI-Quelle — für Politik-Streams, Pressekonferenzen und Barrierefreiheit (BITV)."
---

## Zutaten

### Voraussetzungen
- Windows + NDI-Runtime
- JM Caption (über den Launcher)
- Audioeingang (Mikrofon oder besser ein sauberer Mix)
- Whisper-Modell (Basis mitgeliefert, größere für mehr Genauigkeit nachladbar)

## Schritt-für-Schritt

### Einrichtung
- Audioquelle wählen (Mix bevorzugt gegenüber Raummikrofon)
- Sprache und Whisper-Modell setzen
- Stil und Position der Untertitel anpassen
- NDI-Ausgabe in TriCaster / vMix / OBS als Quelle einbinden
- Optional: Bitfocus Companion (Transkription an/aus, Hold, NDI)

### Während
- Transkription starten
- Bei Fehlern „Hold" zum Einfrieren und die letzte Zeile korrigieren
- Lesbarkeit und Timing im Blick behalten

### Nachbereitung
- Transkription stoppen

## Profi-Tipps
- Größeres Modell = bessere Genauigkeit, aber mehr CPU-Last — vorab unter Realbedingungen testen.
- Sauberer Ton (Pult-Mix statt Raummikro) verbessert die Erkennung deutlich.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| NDI-Quelle erscheint nicht im Mixer | NDI-Runtime und gleiches Subnetz prüfen |
| Untertitel zu spät oder falsch | Modell/Sprache prüfen, Audioqualität verbessern |
| Aussetzer / Ruckeln | CPU-Last beobachten, kleineres Modell wählen |

## Checklisten

### Einrichtung
- [ ] Audioquelle gewählt
- [ ] Modell und Sprache gesetzt
- [ ] NDI-Quelle im Mixer sichtbar
- [ ] Companion (optional) verbunden

### Vor Live
- [ ] Probesatz korrekt erkannt
- [ ] Hold getestet
- [ ] Lesbarkeit und Position ok
