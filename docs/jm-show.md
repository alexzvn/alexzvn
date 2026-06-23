# JM Show — eine ganze Produktion auf einen Klick

> **Kurzfassung:** Eine `.jmshow`-Datei beschreibt eine komplette Produktion
> (Gottesdienst, Event, Sendung). Du öffnest sie im **Launcher**, und der startet
> automatisch alle beteiligten Tools — jedes lädt dabei seinen eigenen Teil
> (Ablaufplan, Folien, Moderationsskript, Bühnen-Anzeige). Kein manuelles
> Öffnen, kein IP-Eintippen.

Diese Anleitung richtet sich an Kolleg:innen, die JM Show **benutzen** wollen.
Die technischen Details zur Auto-Erkennung im Netzwerk stehen in
[suite-discovery.md](suite-discovery.md).

---

## 1. Wozu JM Show?

Bisher hieß Vorbereitung: Timer öffnen und Ablaufplan eintippen, Presenter
öffnen und Foliensatz laden, Prompter öffnen und Skript laden, Stage Display
öffnen und die IP-Adressen der Quellen eintragen. Bei jeder Produktion aufs Neue.

Mit JM Show machst du das **einmal**, speicherst es als `.jmshow`-Datei und
öffnest beim nächsten Mal nur noch diese eine Datei. Alles fährt koordiniert
hoch und ist vorbereitet.

---

## 2. Was steckt in einer `.jmshow`?

Eine `.jmshow` ist eine kleine, gut lesbare JSON-Textdatei. Sie listet die
beteiligten Tools auf und sagt pro Tool, **was** es laden soll:

| Feld | Bedeutung |
|---|---|
| `name` | Anzeigename der Produktion |
| `tools[]` | Liste der beteiligten Tools |
| `tools[].appId` | Welches Tool, z. B. `jm-timer`, `jm-presenter` |
| `tools[].document` | Pfad zum Dokument des Tools (z. B. Foliensatz, Skript) |
| `tools[].network` | `host`/`port` einer Quelle — für Stage Display im LAN |
| `tools[].settings` | Tool-eigene Einstellungen (z. B. Timer-Ablaufplan, Presenter-PIN) |

Die gültigen Tool-IDs (`appId`) sind dieselben wie die App-IDs der Suite:
`jm-timer`, `jm-presenter`, `jm-prompter`, `jm-stage-display`, `jm-switcher`, …

---

## 3. Eine Show anlegen (Launcher)

1. Im **Launcher** den **Show-Editor** öffnen.
2. Einen **Namen** vergeben (z. B. „Sonntagsgottesdienst 10:00").
3. Pro Tool, das mitlaufen soll, das **Häkchen** setzen und je nach Tool:
   - **Dokument auswählen** (Presenter-Foliensatz `.jmpres`, Prompter-Skript
     `.docx`/`.txt`/`.md`),
   - bei vernetzten Quellen den **Host** eintragen (oder leer lassen → siehe
     unten „Ein Rechner vs. mehrere Rechner"),
   - beim **Timer** den **Ablaufplan** direkt im Editor eintippen.
4. **Speichern** → es entsteht eine `.jmshow`-Datei (am besten im
   Produktionsordner neben den Folien/Skripten ablegen).

> **Tipp:** Lege Folien und Skripte **relativ** zur `.jmshow` ab (z. B. einen
> Unterordner `folien/` und `skripte/`). Relative Pfade in der Show werden immer
> relativ zum Ablageort der `.jmshow`-Datei aufgelöst — so bleibt der ganze
> Produktionsordner verschiebbar und kopierbar.

---

## 4. Eine Show öffnen

Im Launcher **„Show öffnen"** wählen und die `.jmshow`-Datei auswählen. Der
Launcher startet daraufhin **alle** in der Show referenzierten Tools und gibt
jedem den Show-Link mit. Jedes Tool lädt dann selbstständig seinen Teil.

Was die einzelnen Tools beim Öffnen tun:

| Tool | Lädt aus der Show … |
|---|---|
| **Timer** | den **Ablaufplan** (`settings.timetable`) und optional die Countdown-Dauer (`settings.durationMs`). Der Timer hat kein eigenes Dokumentformat — seine Daten stehen direkt in der Show. |
| **Presenter** | den referenzierten **Foliensatz** (`document`) und öffnet ihn im Editor. |
| **Prompter** | das referenzierte **Skript** (`document`, `.docx`/`.txt`/`.md`) und springt an den Anfang. |
| **Stage Display** | **verbindet sich** mit allen Quellen, die in derselben Show stehen (Timer/Switcher/Presenter) — Host/Port aus deren `network`-Angabe, sonst Standard/localhost. Die Presenter-PIN kommt aus `settings.pin`. |

> Für Power-User: Der Launcher startet die Tools über den Deep-Link
> `jmps://open?show=<pfad>`. Den kann man auch direkt aufrufen (z. B. aus einem
> Skript) — jedes installierte Tool reagiert darauf.

---

## 5. Ein Rechner vs. mehrere Rechner

**Alles auf einem Rechner** (häufigster Fall): Lass die Host-Felder leer. Die
Tools laufen lokal, Stage Display verbindet sich automatisch auf `localhost`.

**Verteilt auf mehrere Rechner** (z. B. Timer am FOH, Stage Display backstage):
Hier gibt es zwei Wege —

- **Host fest eintragen:** Trag bei der Quelle in der Show die IP des
  jeweiligen Rechners ein (`network.host`). Eindeutig, aber bricht, wenn sich
  die IP ändert.
- **Auto-Erkennung (empfohlen):** Lass den Host leer. Stage Display findet
  aktive Quellen (Timer, Switcher, Presenter) **automatisch im LAN** per mDNS
  und trägt deren Adresse selbst ein. Kein IP-Tippen, robust gegen wechselnde
  IPs. Details: [suite-discovery.md](suite-discovery.md).

> **Wichtig:** Die Auto-Erkennung liefert nur die **Adresse**, nicht das
> Geheimnis. Eine Presenter-**PIN** musst du weiterhin in der Show (oder am
> Stage Display) hinterlegen.

---

## 6. Beispiel: eine vollständige `.jmshow`

```json
{
  "schemaVersion": 1,
  "name": "Sonntagsgottesdienst 10:00",
  "updatedAt": "2026-06-23T08:00:00.000Z",
  "tools": [
    {
      "appId": "jm-timer",
      "settings": {
        "timetable": [
          { "label": "Begruessung",  "durationMs": 300000 },
          { "label": "Lobpreis",     "durationMs": 1200000, "note": "4 Lieder" },
          { "label": "Predigt",      "durationMs": 2400000 }
        ]
      }
    },
    {
      "appId": "jm-presenter",
      "document": "folien/sonntag.jmpres",
      "settings": { "pin": "1234" }
    },
    {
      "appId": "jm-prompter",
      "document": "skripte/moderation.docx"
    },
    {
      "appId": "jm-stage-display"
    }
  ]
}
```

Diese Show öffnet vier Tools: Der **Timer** bekommt einen Ablaufplan
(5 / 20 / 40 Minuten), der **Presenter** lädt `folien/sonntag.jmpres`, der
**Prompter** lädt `skripte/moderation.docx`, und das **Stage Display**
verbindet sich automatisch mit Timer und Presenter (Adresse per Auto-Erkennung,
PIN `1234`). `durationMs` ist in **Millisekunden** (5 min = 300000).

---

## 7. Häufige Stolpersteine

- **Anführungszeichen im JSON:** Wenn du die Datei von Hand bearbeitest, nutze
  gerade ASCII-Anführungszeichen (`"`) und validiere das JSON vor dem Speichern.
  Am einfachsten: über den Show-Editor im Launcher pflegen.
- **Dokument nicht gefunden:** Pfade sind relativ zur `.jmshow`. Wird der
  Foliensatz/das Skript verschoben, ohne die Show anzupassen, lädt das Tool
  leer. Produktionsordner am Stück halten.
- **Stage Display findet die Quelle nicht:** Quelle muss laufen **und** ihren
  Server/Remote aktiv haben (Presenter/Prompter annoncieren nur bei
  eingeschalteter Fernsteuerung, Switcher nur bei laufendem Steuerserver).
  Außerdem müssen beide Rechner im selben Netz/Subnetz sein und mDNS darf nicht
  durch die Firewall blockiert sein. Siehe [suite-discovery.md](suite-discovery.md).
- **Ältere Show-Dateien:** Das Format wird beim Öffnen automatisch auf das
  aktuelle Schema migriert — ältere `.jmshow` öffnen also weiterhin.
