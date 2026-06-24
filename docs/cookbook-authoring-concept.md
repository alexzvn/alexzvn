# Konzept: KI-gestütztes Rezept-Hinzufügen (JM Kochbuch)

**Status:** Konzept / Entscheidung getroffen — noch nicht gebaut.
**Entscheidung:** Pfad **B** (KI über Proxy → PR) als Hauptweg, Pfad **A** (Formular ohne KI) als Fallback für sensible Inhalte.

Ziel: Media Operators sollen neue Rezepte selbst hinzufügen können, ohne Markdown/Git
zu beherrschen — bei garantiert gleichbleibender Form.

## Leitprinzip

**KI assistiert, Guardrails erzwingen, Mensch reviewt.**

Die „immer gleiche Form" ist bereits *strukturell* garantiert und unabhängig davon, wer
oder was ein Rezept schreibt:

- **Schema** — `packages/cookbook/src/types.ts`
- **Compiler mit Validierung** — `packages/cookbook/src/build.mjs` (Pflichtfelder, Kategorien, Enums)
- **CI-Frische-Check** — `.github/workflows/cookbook-check.yml`
- **PR-Review** durch einen Menschen

Die KI füllt nur Inhalt; das Format kann sie nicht brechen — der Compiler lehnt Ungültiges ab.

## Pfad B — „KI über Proxy → PR" (Hauptweg)

1. Operator öffnet im Launcher **„Neues Rezept (KI)"** → Maske: Titel, Kategorie (Dropdown)
   + großes Freitextfeld („Beschreib den Aufbau / kipp deine Notizen rein"), optional Datei.
2. Launcher → **Release-Proxy** (neue Route, z. B. `POST /cookbook/draft`) — Client bleibt
   **tokenlos**, exakt wie bei `/feedback`.
3. Proxy ruft **Claude** (Sonnet oder Haiku) mit System-Prompt =
   `recipe-template.md` + 2–3 Beispielrezepte + Schema + Regel *„Lücken markieren statt erfinden"*
   und der Operator-Eingabe.
4. Claude liefert ein gültiges `.md` → Proxy **validiert serverseitig** (geteilte Logik mit
   `build.mjs`) → erstellt automatisch einen **PR** (GitHub-Token serverseitig).
5. CI `cookbook-check` läuft, Reviewer merged → Rezept live (Launcher + Website + Proxy).

## Pfad A — Formular ohne KI (Fallback, sensible Inhalte)

Geführte Eingabemaske im Cookbook-Modal füllt das Template direkt (kein KI-Aufruf, keine
Daten verlassen das Haus). Für Kunden-/Location-Rezepte mit vertraulichen Details.
Deterministisch, kostenlos, offline. Beide Pfade teilen sich die Validierungslogik.

## Aufwand (grob)

- **Pfad B:** Proxy-Route + Claude-Call + PR-Erstellung (~0,5–1 Tag) · Launcher-Formular
  (~0,5–1 Tag) · Prompt-Tuning/Tests (~0,5 Tag).
- **Pfad A:** Formular + `.md`-Submit (~0,5–1 Tag).
- `build.mjs`-Validierung als gemeinsames, wiederverwendbares Modul herauslösen.

## Kosten

- **Pro Rezept:** ein Claude-Aufruf, wenige Tausend Token rein, ~1–2k raus → Bruchteile
  eines Cent (Haiku) bis wenige Cent (Sonnet). Opus nicht nötig (strukturierte Umformulierung).
  Exakte Modelle/Preise beim Bau bestätigen.
- **Einmalig:** der Integrationsaufwand oben.

## Datenschutz (Ministeriums-/Kundenkontext)

- Generische Best-Practice-/Technik-Rezepte: unkritisch. **Kunden-/Location-Rezepte**
  (z. B. BMUKN) können vertrauliche Details enthalten → sensibel.
- Maßnahmen:
  - API-Key **nur serverseitig** (Proxy); Clients bleiben tokenlos.
  - Anthropic-API mit **No-Training / Zero-Retention** + EU-Datenverarbeitung prüfen/konfigurieren.
  - Sensible Identifikatoren **anonymisieren** oder solche Rezepte über **Pfad A (ohne KI)**.
  - **PR-Review** vor Veröffentlichung als Pflicht-Gate.
  - UI-Hinweis: „Keine personenbezogenen/vertraulichen Kundendaten in den KI-Entwurf geben."

## Risiken & Gegenmaßnahmen

- Halluzinierte Details → Prompt-Regel „Lücken markieren statt erfinden" + Review.
- Format-Drift → strukturell unmöglich (Compiler/CI lehnt ab).
- Fehlende Pflichtfelder → serverseitige Validierung gibt dem Operator verständliches Feedback.

## Offene Voraussetzungen für den Bau

- **Anthropic-API-Key** (serverseitig im Proxy als Secret) + Kostenträger/Account.
- **Modellwahl:** Sonnet (Qualität) vs. Haiku (Kosten) — ggf. kurz gegeneinander testen.
- **Output-Form = PR vs. Issue:** ein PR erfordert einen GitHub-Token mit `Contents: write`
  + `Pull requests: write`. Der heutige Proxy-Token kann nur `Contents: read` + `issues: write`
  (für `/feedback`). Entweder Token-Scope erweitern (→ PR) oder vorerst als **Issue** ausgeben.
- **Datenschutz-Freigabe** für das Senden von Rezept-Inhalten an die Anthropic-API.
- **Beispielrezepte** als Few-Shot-Stilvorlage festlegen (Vorschlag: Hybrid-Konferenz +
  Audio-Grundsetup + BMUKN).
