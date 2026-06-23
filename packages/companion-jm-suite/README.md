# JM Suite — Bitfocus Companion Module

> **Ein Modul für die ganze Suite.** Statt pro Tool ein eigenes Companion-Modul
> gibt es **eine** Verbindung je Tool: Rolle wählen (Switcher, Timer, Player,
> Titler, Presenter, Prompter, Recorder, DAW) — Actions, Feedbacks (Button-
> Farben/Tally) und Variablen werden **automatisch** aus der geteilten
> Capabilities-Tabelle der Suite generiert.

Gesprochen wird das suite-weite TCP-Zeilenprotokoll
([`@jm/suite-control-protocol`](../suite-control-protocol/README.md)).

## Verwendung in Companion

1. Verbindung „JM Suite" hinzufügen.
2. **Tool (Rolle)** wählen, **IP-Adresse** des Tool-Rechners und **Port** setzen.
   Standard-Ports: Switcher 8723, Prompter 8727, Timer 8724, Player 8725,
   Titler 8726, Presenter 8728, Recorder 8729, DAW 8730.
3. Für mehrere Tools einfach mehrere „JM Suite"-Verbindungen anlegen (eine je
   Tool).

Die Actions/Feedbacks/Variablen erscheinen passend zur gewählten Rolle. Presets
liefern fertige Buttons je Tool.

## Aufbau

| Datei | Inhalt |
|---|---|
| `main.js` | Companion-Modul (InstanceBase). Generiert Definitionen aus `CAPABILITIES`, verbindet per TCP, liest STATE → Variablen/Feedbacks. |
| `lib.mjs` | Pure Hilfsfunktionen (Zeilenbau, Optionsfelder, Toggle-Auflösung) — ohne Companion-Runtime testbar. |
| `generated/protocol.mjs` | **Generiert** aus `packages/suite-control-protocol/src/{index,capabilities}.ts` — Parser + Capabilities. NICHT von Hand bearbeiten. |
| `companion/manifest.json` | Companion-Modul-Manifest (node22, nodejs-ipc). |

## Protokoll synchron halten

Das Modul liegt **außerhalb** der npm-workspaces (standalone baubar). Ändert sich
das Protokoll oder die Capabilities-Tabelle in `packages/suite-control-protocol`,
neu generieren:

```
npm run sync      # → generated/protocol.mjs neu bauen (esbuild)
```

Die generierte Datei ist eingecheckt, damit das Modul ohne Monorepo-Quelle
baubar/verteilbar bleibt.

## Bauen / Testen

```
npm run selftest  # Zeilenbau + Round-Trip gegen den Protokoll-Parser
npm run build     # companion-module-build (Paket für Companion)
```

> Das ältere `jm-switcher`-Modul bleibt vorerst als Bestandsschutz; `jm-suite`
> deckt den Switcher (Rolle „switcher") rückwärtskompatibel mit ab.
