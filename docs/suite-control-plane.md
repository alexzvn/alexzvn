# Suite-Steuerebene & Companion — `@jm/suite-control-protocol`

> **Kurzfassung:** Eine einheitliche Fernsteuer-Schicht für die **ganze** Suite.
> Jedes Tool spricht dasselbe TCP-Zeilenprotokoll (namespaced Befehle +
> generischer Status-Push), annonciert sich per [mDNS](suite-discovery.md) und
> ist damit über **ein** generisches Bitfocus-Companion-Modul bedienbar — statt
> wie bisher nur der Switcher. Das ist das Fundament, um die Suite zu einem
> Ökosystem zu machen, in dem Produktionen maximal flexibel ferngesteuert werden.

Dieses Dokument hält Architektur, Companion-Anbindung und Migrationsweg fest
(Roadmap **Welle 1**). Der Implementierungsstand steht in
[§6](#6-stand--offene-punkte).

---

## 1. Warum

Vorher hatte jedes Tool eine eigene, inkompatible Steuer-API: Switcher TCP
(`@jm/companion-protocol`, Port 8723), Timer Socket.IO (7777), Presenter HTTP+SSE
(7330), Studio Control REST (7778) — und Player/Prompter/Titler/Recorder/DAW
**gar keine**. Companion erreichte nur den Switcher.

Die Steuerebene vereinheitlicht das: **ein** Protokoll, **ein** Server-Baustein,
**ein** Companion-Modul, **ein** Tally-Rückkanal. Neue Tools sind „plug & play"
fernsteuerbar, sobald sie den Server einbinden und sich per mDNS annoncieren.

---

## 2. Protokoll (Kurzreferenz)

Zeilenbasiert, ASCII, `\n`-terminiert. Vollständig in
[`packages/suite-control-protocol/README.md`](../packages/suite-control-protocol/README.md).

- **Befehl:** `<NAMESPACE> <VERB> [args…]` — z. B. `TIMER START`, `PLAYER CUE 3`,
  `TITLER TAKE 2`. Status anfordern: `STATE?`.
- **Status:** `STATE ns=<rolle> <key>=<value> …` — beliebige Felder, Booleans als
  `1`/`0`.
- **Rückwärtskompatibel:** Switcher-Verben ohne Namespace (`PREVIEW 2`, `CUT`)
  gelten als `ns=switcher`; das alte Companion-Modul liest die STATE-Felder per
  Schlüssel und ignoriert `ns`. Details + Selbsttest siehe Paket-README.

---

## 3. Bausteine

```
packages/suite-control-protocol/
  src/index.ts         pure  — Parser/Formatter/Typen + Legacy-Switcher-Shims
  src/capabilities.ts  pure  — CAPABILITIES je Rolle (Companion-Generierung + Doku)
  src/server.ts        node  — SuiteControlServer (net.Server + mDNS-Annoncierung)
  src/client.ts        node  — SuiteControlClient (Auto-Reconnect, Status lesen)
```

- **`SuiteControlServer`** verallgemeinert den bisherigen Switcher-Steuerserver
  ([apps/switcher/src/main/control-server.ts](../apps/switcher/src/main/control-server.ts)):
  Begrüßung mit aktuellem Status, `STATE?`-Beantwortung, Broadcast bei Änderung,
  mDNS gekoppelt an den laufenden Server. Jedes Tool instanziiert ihn mit seiner
  `role`/`appId`.
- **`SuiteControlClient`** verallgemeinert den Stage-Display-Switcher-Client
  ([apps/stage-display/src/main/switcher-client.ts](../apps/stage-display/src/main/switcher-client.ts)).
- Die **pure** Schicht (`index.ts` + `capabilities.ts`) ist frei von
  node/electron — sie wird unverändert ins standalone baubare Companion-Modul
  kopiert (siehe [§5](#5-companion-anbindung-option-a)).

`@jm/companion-protocol` ist nur noch ein **dünner Re-Export** dieses Pakets;
bestehende Importe (`SwitcherStateMsg`, `parseState`, …) laufen unverändert.

---

## 4. Tally-Rückkanal (ein Strom, zwei Konsumenten)

Jedes Tool broadcastet `STATE ns=… …` über `SuiteControlServer.pushState` an
**alle** TCP-Clients. Companion (Button-Farben/Variablen) und **Stage Display**
hängen am **selben** Strom — ein Tool unterscheidet nicht zwischen „Tally für
Companion" und „Tally für Stage Display". Stage Display nutzt künftig den
gemeinsamen `SuiteControlClient` für alle Tools; der Switcher-Fall ist nur noch
`ns=switcher`.

---

## 5. Companion-Anbindung (Option A)

Gewählt: **ein generisches „JM Suite"-Companion-Modul** mit mDNS-Auto-Discovery
(statt eines Moduls pro Tool). Geplantes Paket `packages/companion-jm-suite`,
analog `companion-jm-switcher` aus den Workspaces ausgeschlossen (standalone
baubar).

- Das Modul iteriert die **Capabilities-Tabelle** und erzeugt je gefundener
  Rolle `setActionDefinitions` / `setFeedbackDefinitions` /
  `setVariableDefinitions`. Action-IDs deterministisch als `role.verb` (überleben
  Reconnects und gespeicherte Buttons).
- **Stufe 1:** manuelle Instanz-Config (`host:port:role`) — beweist das
  generalisierte Protokoll mit minimalem Risiko.
- **Stufe 2:** mDNS-Auto-Discovery (`bonjour-service`) — Tool starten → erscheint
  automatisch in Companion.
- **Keine Protokoll-Duplizierung:** `scripts/sync-companion-protocol.mjs` kopiert
  die pure Schicht (`index.ts` + `capabilities.ts`) per `prebuild`-Hook in das
  Modul (DO-NOT-EDIT-Header). Eine Quelle der Wahrheit, Modul bleibt standalone.

Das bestehende `companion-jm-switcher` bleibt vorerst als Bestandsschutz und wird
später als deprecated markiert.

---

## 6. Stand & offene Punkte

**Erledigt (Welle 1.0 + 1.1):**

- `@jm/suite-control-protocol` angelegt: pure Parser/Formatter + generischer
  STATE + Capabilities-Tabelle (Seeds für switcher/timer/player/titler/prompter/
  presenter/recorder/daw) + `SuiteControlServer`/`SuiteControlClient`.
- `@jm/companion-protocol` auf dünnen Re-Export umgestellt — voll
  rückwärtskompatibel.
- **Switcher** und **Stage Display** auf die geteilten Bausteine umgestellt,
  **ohne Verhaltensänderung** (Switcher sendet `ns=switcher`-STATE, das das alte
  Companion-Modul weiterhin liest).
- Verifikation grün: Paket-Selftest (inkl. Rückwärtskompat), `typecheck:node`
  für Switcher und Stage Display, electron-vite-**Build** beider Apps (Subpfade
  `…/server` bzw. `…/client` werden korrekt gebündelt).

**Erledigt (Welle 1.2 — Timer):** TCP-Steuerserver auf Port 8724 neben Socket.IO
(7777); Befehle TIMER START/STOP/RESET/ADD/SET/GOTO/NEXT/PREV; STATE-Push
remaining/remaining_s/running/overrun/warning/block_label
([apps/timer/src/main/control-server.ts](../apps/timer/src/main/control-server.ts)).

**Erledigt (Welle 1.3 — Player):** TCP-Steuerserver auf Port 8725; da Wiedergabe
im Renderer (WebAudio) lebt, gehen Befehle per IPC an den Renderer, der seinen
Zustand zurückmeldet. Befehle PLAYER GO/STOP/PAUSE/PANIC/CUE/STANDBY/NEXT/PREV/PAD
(Cue-Show + Soundboard); STATE-Push playing/paused/standby/standby_label/cues/
playing_count ([apps/player/src/main/control-server.ts](../apps/player/src/main/control-server.ts)).

**Erledigt (Welle 1.4 — Titler):** TCP-Steuerserver auf Port 8726; Take/Clear ist
Live-Zustand im Renderer (engine.ts), Befehle gehen per IPC an OperatorView, der
Zustand wird zurückgemeldet. Befehle TITLER TAKE/CLEAR/TOGGLE/TEMPLATE; STATE-Push
on_air/template/ndi/connections
([apps/titler/src/main/control-server.ts](../apps/titler/src/main/control-server.ts)).
Der Titler zeigt EINE CG (keine nummerierten Bauchbinden) — Mapping entsprechend.

**Erledigt (Welle 1.5 — Presenter/Prompter/Recorder/DAW):** vier weitere Tools am
Steuerprotokoll. Presenter (8728, NEXT/PREV/GOTO/BLACK/WHITE/LIVE/STOP, nutzt
present.ts + subscribe). Prompter (8727, SCROLL/SPEED/FASTER/SLOWER/TOP; GOTO
zurückgestellt). Recorder (8729, RECORD/ARM/DISARM; State aus Main, Befehle an
Renderer wegen Ordner-Settings). DAW (8730, PLAY/STOP/TOGGLE/REC; Transport +
Rec-Flows im Renderer → Befehl an Renderer, State zurück).

Damit deckt die Steuerebene **8 Tools** ab (Switcher, Timer, Player, Titler,
Presenter, Prompter, Recorder, DAW) auf Ports 8723–8730.

**Erledigt (Welle 1.6, Stufe 1 — Companion-Modul):** `packages/companion-jm-suite`
— EIN Companion-Modul für alle Tools. Je Verbindung wählt man die Rolle; Actions/
Feedbacks/Variablen/Presets werden aus der Capabilities-Tabelle generiert (manuell
host:port:role). Keine Protokoll-Duplizierung: `scripts/sync-companion-protocol.mjs`
bündelt `index.ts`+`capabilities.ts` per esbuild in `generated/protocol.mjs`
(eingecheckt, Modul aus workspaces excludiert). Pure Logik in `lib.mjs`. Selftest
mit Round-Trip: alle 44 Actions über 8 Tools bauen parsebare Protokollzeilen.

**Als Nächstes (Welle 1.6 Stufe 2 + 1.7):**

| Schritt | Inhalt | Datei(en) |
|---|---|---|
| 1.6-2 | **mDNS-Auto-Discovery** im Modul — Steuer-Endpunkte mit `ctl=1`-TXT annoncieren (@jm/discovery-Erweiterung) + Stage-Display-Filter, dann Modul findet Tools automatisch | packages/discovery, apps/*/control-server.ts, apps/stage-display, packages/companion-jm-suite |
| 1.7 | Companion-Modul paketieren/verteilen; Versions-Bumps + Manifest/Changelog | packages/companion-jm-suite, packages/suite-manifest/ |

**Bewusst (noch) nicht gemacht:**

- Studio-Control-**Gateway** (Option B: Companion über Studio Control mit
  Auth/Audit) — optionaler Zusatzpfad, später (Roadmap Welle 5).
- Echte Steuerports der Tools: die Default-Ports in der Capabilities-Tabelle
  (8723 ff.) dienen der manuellen Companion-Config; sobald das Companion-Modul
  (1.6) mDNS-Auto-Discovery hat, liefert der Fund den realen Port. Nachgerüstete
  Tools annoncieren ihren Steuer-Endpunkt vorerst NICHT (`advertiseService:false`),
  damit Aggregatoren wie das Stage Display (die per `role` discovern) nicht
  gestört werden — die Disambiguierung Steuer- vs. Socket.IO/SSE-Endpunkt löst 1.6.

Gesamt-Roadmap: siehe den freigegebenen Plan
(`.claude/plans/moin-analysiere-bitte-die-streamed-kite.md`).
