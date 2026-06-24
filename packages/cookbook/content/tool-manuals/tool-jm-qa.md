---
id: tool-jm-qa
title: "JM Q&A — Wortmeldungen & Saal-Fragen"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 20
teamSize: "1-2"
tags: [qa, wortmeldung, pressekonferenz, townhall, qr, manual]
relatedTools: [jm-qa, jm-timer, jm-titler]
prerequisites:
  - JM Q&A installiert (über den Launcher)
  - Netz/WLAN für die Saal-Einreichung per QR-Code
  - JM Timer und JM Titler im selben LAN (für die Auto-Kopplung)
equipmentOwner: jm
crewRoles:
  - Moderations-Operator
  - Moderation (Freigabe)
lastReviewed: 2026-06-24
owner: tech@jakobsmedien.com
summary: "Wortmeldungs- und Frage-Queue: der Saal reicht per QR vom Handy ein, per Klick kommt jemand ans Wort — steuert dabei Redezeit (Timer) und Bauchbinde (Titler) automatisch."
---

## Zutaten

### Voraussetzungen
- JM Q&A (über den Launcher)
- Netz/WLAN, über das die Gäste den QR-Code erreichen
- JM Timer und JM Titler im selben LAN

## Schritt-für-Schritt

### Einrichtung
- QR-Einreichung aktivieren (Gäste scannen, Fragen laufen in die Queue)
- Moderation/Freigabe einstellen (Filter vor Veröffentlichung)
- Kopplung mit JM Timer (Redezeit) und JM Titler (Name/Funktion) prüfen
- Optional: Bitfocus Companion verbinden

### Während
- Eingehende Fragen moderieren und freigeben
- Per Klick jemanden ans Wort holen — Timer startet, Bauchbinde wird eingeblendet
- Queue abarbeiten

### Nachbereitung
- Queue/Statistik sichern (falls gewünscht)

## Profi-Tipps
- Den Moderationsschritt aktiv nutzen, um Doppelungen und Unangemessenes zu filtern.
- Titler-Text ist vorwärtskompatibel (TITLER TEXT) — funktioniert auch mit älteren Titler-Ständen.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| QR-Einreichung kommt nicht an | Gleiches Netz und Erreichbarkeit der Einreich-Seite prüfen |
| Timer/Titler reagieren nicht | Im selben LAN gestartet? mDNS/Firewall prüfen |

## Checklisten

### Einrichtung
- [ ] QR-Einreichung aktiv
- [ ] Moderation/Freigabe gesetzt
- [ ] Timer und Titler gekoppelt

### Vor Live
- [ ] Testfrage eingereicht und sichtbar
- [ ] Ans-Wort-holen getestet (Timer + Bauchbinde)
