# Release-Checkliste — Welle 1: Suite-Steuerebene + Companion

Begleitet das Scharfschalten der **Steuerebene** (Wellen 1.2–1.6: Companion-
Fernsteuerung + mDNS-Auto-Discovery). Ergänzt die allgemeine
[`release-smoke-test.md`](release-smoke-test.md) um die steuerebenen-spezifischen
Punkte. Architektur: [`suite-control-plane.md`](suite-control-plane.md).

Branch: `feat/suite-control-plane` (14 Commits vor `main`, sauberer FF-Merge).
Legende: ☐ offen · ✅ ok · ❌ Fehler (Notiz dahinter)

---

## 0. Was hier released wird

| Tool | Version | Build | Änderung |
|---|---|---|---|
| Timer | 0.2.1 → **0.3.0** | CI | Companion-Fernsteuerung + mDNS |
| Player | 0.5.0 → **0.6.0** | CI | Companion-Fernsteuerung + mDNS |
| Presenter | 0.7.1 → **0.8.0** | CI | Companion-Fernsteuerung + mDNS |
| Prompter | 0.4.1 → **0.5.0** | CI | Companion-Fernsteuerung + mDNS |
| Stage Display | 0.4.1 → **0.4.2** | CI | **Kompat:** `!ctl`-Filter (s. u.) |
| Titler | 0.2.0 → **0.3.0** | **nativ** (@jm/ndi) | Companion-Fernsteuerung + mDNS |
| Recorder | 0.4.0 → **0.5.0** | **nativ** (@jm/audio) | Companion-Fernsteuerung + mDNS |
| DAW | 0.7.1 → **0.8.0** | **nativ** (@jm/audio) | Companion-Fernsteuerung + mDNS |
| Switcher | 0.4.0 (unverändert) | — | bereits Companion-steuerbar |

> ⚠️ **Reihenfolge-Regel:** **Stage Display 0.4.2 mit oder VOR** den anderen Tools
> ausliefern. Ein altes Stage Display (≤0.4.1) greift sonst nach dem neuen
> `ctl=1`-Steuerport eines Tools und misskonnektiert seinen Socket.IO-/SSE-Client.

---

## A. Vorbereitung

- ☐ Branch aktuell, sauberer Tree; `npm install --ignore-scripts --no-audit --no-fund`
- ☐ Build aller betroffenen Apps grün:
  `npm run build -w @jm/timer -w @jm/player -w @jm/presenter -w @jm/prompter -w @jm/stage-display -w @jm/titler -w @jm/recorder -w @jm/daw -w @jm/switcher`
- ☐ Protokoll-Selftest grün: `npm run selftest -w @jm/suite-control-protocol`
- ☐ Companion-Modul-Selftest grün: `node packages/companion-jm-suite/test/selftest.mjs`

---

## B. Steuerebene — Dev-Durchlauf (`npm run dev -w @jm/<app>`)

### B1 · Befehl & Status je Tool (ein Rechner)
Werkzeug: Bitfocus Companion (Verbindung „JM Suite", Rolle + `127.0.0.1` + Port)
**oder** schnell `ncat 127.0.0.1 <port>` / `telnet` und die Zeile tippen.

- ☐ **Timer** (8724): `TIMER START` → Countdown läuft; `STATE?` liefert `running=1`; `TIMER STOP`
- ☐ **Player** (8725): `PLAYER CUE 1` → Cue 1 spielt; `PLAYER STOP`; `PLAYER PAD 1`
- ☐ **Titler** (8726): `TITLER TAKE` → Bauchbinde on air (`on_air=1`); `TITLER CLEAR`
- ☐ **Presenter** (8728): `PRESENTER NEXT`/`PRESENTER PREV` → Folie wechselt; `PRESENTER GOTO 1`
- ☐ **Prompter** (8727): `PROMPTER SCROLL ON` → scrollt; `PROMPTER FASTER`; `PROMPTER SCROLL OFF`
- ☐ **Recorder** (8729): `RECORDER RECORD ON` → Aufnahme startet (Zielordner gesetzt); `RECORDER RECORD OFF`
- ☐ **DAW** (8730): `DAW PLAY` → Transport läuft; `DAW STOP`; `DAW REC ON`
- ☐ **Switcher** (8723, Regression): `PREVIEW 2` + `CUT` wirken; altes `companion-jm-switcher` läuft weiter
- ☐ Jeweils: bei Zustandsänderung kommt eine `STATE ns=<rolle> …`-Zeile (Companion-Feedback/Variable aktualisiert)

### B2 · mDNS-Steuer-Endpunkte sichtbar (ein Rechner)
- ☐ Mehrere Tools starten, dann `node scripts/mdns-scan.mjs` (separates Terminal)
- ☐ Jedes laufende Tool erscheint mit **`ctl`** (Steuer-Endpunkt, Port 8723–8730)
- ☐ Timer/Presenter/Prompter erscheinen **zusätzlich** ohne `ctl` (eigener Dienst)
- ☐ Switcher erscheint **nur einmal** (ohne `ctl`)
- ☐ Companion-Verbindung auf **Automatisch (mDNS)** + Rolle → verbindet ohne IP-Eingabe

### B3 · Stage-Display-Regression (kritisch für die Kompat)
- ☐ Timer **und** sein Steuer-Endpunkt laufen (Scan zeigt timer mit und ohne `ctl`)
- ☐ Stage Display (Timer-Quelle aktiv, nicht verbunden) verbindet sich weiterhin
  auf den **Socket.IO**-Port (7777), **nicht** auf 8724
- ☐ Dasselbe für Presenter (SSE 7330, nicht 8728)

---

## C. Paket-/Netz-Durchlauf (nur mit echten Buildern / 2 Rechnern)

### C1 · mDNS-Auto-Discovery über zwei Rechner *(das eigentliche Release-Gate)*
- ☐ Rechner A: ein nachgerüstetes Tool starten (z. B. Timer). Rechner B: `node scripts/mdns-scan.mjs`
- ☐ Beide im **selben Subnetz**, UDP **5353** offen
- ☐ B sieht den `ctl`-Endpunkt von A mit korrekter A-IP
- ☐ Companion auf B (Modus Automatisch) → verbindet sich auf den Tool-Rechner A; Button steuert das Tool auf A
- ☐ Tool auf A beenden → verschwindet im Scan und in Companion (Status getrennt)

### C2 · Start-Smoke der gepackten Tools
- ☐ Jedes neu gepackte Tool startet ohne „Cannot find module" (Bundling von
  `@jm/suite-control-protocol/server` + `@jm/discovery` + `bonjour-service` ok)

---

## D. Build & Release (pro Tool)

Tag-Schema: **`<app>-v<version>`** (z. B. `timer-v0.3.0`). Der Katalog
(`suite.json`) wird **nach** dem Build gesetzt — nicht vorab (sonst zeigt der
Launcher eine Version ohne Installer).

### D1 · CI-Tools (Timer, Player, Presenter, Prompter, Stage Display)
- ☐ **Stage Display zuerst:** `git tag stage-display-v0.4.2 && git push origin stage-display-v0.4.2`
- ☐ Workflow „Suite Release" baut Mac+Win, legt das GitHub-Release an und bumpt
  `suite.json` automatisch (`bump-manifest.mjs`) auf dem `MANIFEST_REF`-Branch
- ☐ Dann je `timer-v0.3.0`, `player-v0.6.0`, `presenter-v0.8.0`, `prompter-v0.5.0` taggen + pushen
- ☐ Pro Tool: Release-Assets (`.dmg`/`.exe`) vorhanden, `suite.json latestVersion` nachgezogen

### D2 · Native Tools (Titler, Recorder, DAW) — lokal auf Windows
CI überspringt diese (NDI-/PortAudio-/ASIO-SDK fehlt auf Runnern). Je Tool:
- ☐ `npm run dist:win -w @jm/<app>` → Installer in `apps/<app>/release/`
- ☐ `gh release create <app>-v<version> --title "<app> <app>-v<version>" --prerelease apps/<app>/release/*.exe`
- ☐ `node scripts/bump-manifest.mjs <app> <version>` → `suite.json` aktualisieren
- ☐ Den `suite.json`-Bump auf den `MANIFEST_REF`-Branch committen + pushen
- ☐ Tools: `titler 0.3.0`, `recorder 0.5.0`, `daw 0.8.0`

### D3 · Merge + Changelog
- ☐ `feat/suite-control-plane` → `main` mergen (bringt Code + `package.json`-Bumps
  + `changelog.json`-Einträge nach `main`; der Proxy liest die Notes live)
- ☐ Prüfen: im Launcher erscheinen die neuen Patch Notes je Tool (ohne Launcher-Update)

### D4 · Companion-Modul (separat, nicht über suite.json)
- ☐ `packages/companion-jm-suite` **standalone** auschecken/kopieren (außerhalb des Monorepos)
- ☐ `npm install && npm run build` → Verteilpaket; in eure Companion-Instanzen einspielen
- ☐ Alternativ vorerst Developer-Mode (Settings → Developer modules path → Modulordner)

---

## E. Freigabe-Gate

- ☐ **C1 grün** (2-Rechner-mDNS) — oder bewusst auf manuelle IP/Port-Config zurückgefallen
- ☐ **B3 grün** (Stage Display verbindet weiter korrekt) — sonst Tool-Release stoppen
- ☐ Stage Display 0.4.2 ist live, **bevor** Nutzer die Tool-Updates ziehen
- ☐ Switcher unverändert (kein Release, alte Companion-Steuerung intakt)

**Faustregel:** Klappt C1 nicht, ist das kein Show-Stopper für den Release —
die manuelle IP/Port-Config in Companion funktioniert weiter. Klappt **B3**
nicht, dann den Tool-Release verschieben, bis Stage Display 0.4.2 ausgeliefert
ist (sonst Fehlverbindungen im Feld).
