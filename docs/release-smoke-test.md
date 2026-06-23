# Release-Smoke-Test — JM Production Suite

Manuelle Prüf-Checkliste **vor jedem Release**. Headless/CI kann GUI, Audio und
LAN-Verhalten nicht prüfen — das passiert hier von Hand. Reihenfolge: erst der
schnelle Dev-Durchlauf (Abschnitt B), dann der Paket-Durchlauf für die Dinge,
die nur mit echter `.exe`/`.dmg` testbar sind (Abschnitt C).

> **Diese Runde (Branch `feat/suite-newtools`)** deckt ab: W0-Runtime, Launcher
> A1–A7, Show/Deep-Links (B1–B4), mDNS (B5), DAW C1. Die kritischsten Punkte sind
> **A4 Silent-Update** (betrifft die Update-Mechanik aller Tools) und **mDNS über
> zwei Rechner**.

Legende: ☐ offen · ✅ ok · ❌ Fehler (Notiz dahinter)

---

## A. Vorbereitung

- ☐ Branch aktuell: `git pull` auf `feat/suite-newtools`, sauberer Tree
- ☐ Dependencies frisch: `npm install --ignore-scripts --no-audit --no-fund`
- ☐ Build aller betroffenen Apps grün:
  `npm run build -w @jm/launcher -w @jm/daw -w @jm/timer -w @jm/presenter -w @jm/prompter -w @jm/stage-display -w @jm/switcher`
- ☐ Beispiel-Produktion bereit: ein Ordner mit `demo.jmshow`, einem Presenter-
  Foliensatz und einem Prompter-Skript (siehe `docs/jm-show.md`, Abschnitt 6)

---

## B. Dev-Durchlauf (`npm run dev -w @jm/<app>`)

### B1 · W0: Logging & Crash (eine beliebige App)
- ☐ Nach Start existiert `…/userData/logs/main.log` mit strukturierten Einträgen (appId-Präfix)
- ☐ Künstlicher `throw` im Main → Eintrag im Log **und** `userData/last-crash.json` geschrieben
- ☐ Im Launcher erscheint danach ein **Crash-Badge** für das Tool

### B2 · A3: Presence / System-Zustand
- ☐ Zwei Tools starten → Launcher „System-Zustand": beide **laufend**, mit Version + Last-Seen
- ☐ Ein Tool beenden → Status wechselt binnen ~25 s auf **gestoppt**
- ☐ Nach simuliertem Crash (B1) zeigt die Ansicht den letzten Fehler

### B3 · A5/A7: Updates & Feedback (UI-Pfad, ohne echte Installation)
- ☐ „Alle aktualisieren" ist sichtbar/klickbar, Fortschritt wird angezeigt
- ☐ Feedback senden mit „Logs anhängen" → ZIP-Bundle wird erzeugt/angehängt

### B4 · B1/B3/B4: Show öffnen
- ☐ Launcher → „Show öffnen" → `demo.jmshow` → Timer/Presenter/Prompter/Stage starten **koordiniert**
- ☐ **Timer** zeigt den Ablaufplan aus der Show
- ☐ **Presenter** hat den referenzierten Foliensatz geladen
- ☐ **Prompter** hat das Skript geladen und steht am Anfang
- ☐ **Stage Display** zeigt den Timer-Countdown (verbunden)
- ☐ Show-Editor: Anlegen/Bearbeiten/Speichern erzeugt valide `.jmshow` (JSON-Quote-Falle beachten)

### B5 · B5 mDNS, ein Rechner
- ☐ Timer starten (Server läuft), Stage Display mit aktivierter, aber nicht
  verbundener Timer-Quelle → Stage verbindet sich **ohne** IP-Eingabe auf localhost
- ☐ Presenter-Fernsteuerung an → Stage findet Presenter; Switcher-Steuerserver an → Stage findet Switcher
- ☐ Bereits stehende lokale Verbindung wird **nicht** umgebogen; deaktivierte Quelle bleibt aus

### B6 · Prompter-Scroll-Fix
- ☐ Langes Skript laden, Ausgabe auf 2. Monitor, Wiedergabe starten
- ☐ Text scrollt **durchgängig bis zum Ende** — kein Stehenbleiben in der Mitte
- ☐ Tempo-/Schriftgröße-Änderung während des Laufs → kein Sprung, kein Stopp

### B7 · DAW C1: Crossfade & Normalisieren
- ☐ Zwei Clips auf **einer** Spur so ziehen, dass sie überlappen → in der Timeline erscheint die Überblendung
- ☐ Wiedergabe über die Überlappung → **hörbare Überblendung** (kein Knacken, kein Lautstärkesprung)
- ☐ Export (WAV) → die Überblendung ist **in der Datei** enthalten
- ☐ Clip wählen → Inspector „Normalisieren" mit Ziel (z. B. −1 dBFS) → „Anwenden": Clip-Pegel hebt/senkt korrekt
- ☐ Undo (Strg+Z) macht Normalisieren rückgängig
- ☐ **Regression:** bestehende Ein-/Ausblenden (ohne Überlappung) klingen unverändert

---

## C. Paket-Durchlauf (echte Installer — nur hier prüfbar)

> Bauen: `npm run dist:win -w @jm/<app>` (Switcher/Recorder brauchen den lokalen
> Native-Build, nicht CI). Für A4 brauchst du zwei Versionsstände (installiert
> = N, Update = N+1).

### C1 · A4: Silent-/Unattended-Update (höchstes Risiko)
- ☐ Installierte App (Version N) vorhanden; Update (N+1) bereitgestellt
- ☐ „Aktualisieren" installiert **ohne** manuellen Installer-Dialog
- ☐ Nach Erfolg: neue Binary vorhanden, Version N+1 läuft, `recordInstalled` erst **nach** Verifikation
- ☐ **Abbruch-/Blockfall** (SmartScreen blockt o. Ä.): Update wird **nicht** als Erfolg verbucht → Fallback auf interaktiven Installer
- ☐ `updateLauncher` (Launcher aktualisiert sich selbst) funktioniert weiterhin

### C2 · B5 mDNS über zwei Rechner
- ☐ Rechner A: Timer starten · Rechner B: Stage Display (Timer-Quelle aktiviert, leerer/falscher Host)
- ☐ Beide im **selben Subnetz**, UDP **5353** nicht durch Firewall blockiert
- ☐ Stage Display füllt den Timer-Host **automatisch** und verbindet sich
- ☐ Quelle beenden → verschwindet wieder aus der Erkennung

### C3 · Start-Smoke aller gepackten Tools
- ☐ Jedes neu gepackte Tool startet ohne „Cannot find module"/Render-Fehler (Bundling der Source-Packages ok)
- ☐ Deep-Link `jmps://open?show=<pfad>` startet/fokussiert das jeweilige Tool

---

## D. Freigabe (Release-Gate)

- ☐ **B7 grün** → DAW ist freigabefähig (geringeres Risiko) → zuerst releasen
- ☐ **C1 grün** → Launcher freigabefähig — **ohne** grünes C1 keinen Launcher-Release
- ☐ **C2 grün** (oder bewusst auf „fester Host" zurückgefallen) → mDNS-Versprechen hält
- ☐ Versions-Bump + Changelog-Eintrag je Tool (ASCII-Quotes-Falle in changelog/suite.json beachten)
- ☐ Tag setzen → CI-Release (A6 bumpt `suite.json` automatisch); Switcher/Recorder lokal bauen

**Faustregel:** Schlägt ein A4-Punkt (C1) fehl, Launcher-Release verschieben —
eine kaputte Update-Mechanik trifft über den Live-Katalog alle Nutzer und ist
schwer zurückzuholen.
