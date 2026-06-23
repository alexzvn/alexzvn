# Suite-Auto-Discovery (mDNS) — `@jm/discovery`

> **Kurzfassung:** Quellen der Suite (Timer, Presenter, Prompter, Switcher)
> machen sich im LAN per mDNS/Bonjour bekannt. Aggregatoren — heute das
> **Stage Display** — finden sie automatisch und verbinden sich, ohne dass
> jemand IP-Adresse oder Port von Hand einträgt. Das ist die optionale
> Komfort-Schicht unter [JM Show](jm-show.md): Host-Felder dürfen leer bleiben.

Dieses Dokument hält den Stand der Implementierung fest (Workstream B5 inkl.
Erweiterung) — für Entwickler:innen und für die Betriebs-Diagnose.

---

## 1. Wie es funktioniert

- **Diensttyp:** `_jmps._tcp` (Konstante `SERVICE_TYPE = 'jmps'`).
- **TXT-Records:** jede Quelle annonciert `{ appId, role }`. Der Port steht im
  SRV-Record des Dienstes.
- **Adresse:** der Konsument bevorzugt eine IPv4-Adresse aus dem Fund, sonst den
  Hostnamen.
- **Paket:** [`packages/discovery`](../packages/discovery/src/index.ts)
  (`@jm/discovery`) kapselt das. Es nutzt `bonjour-service` (→ `multicast-dns`,
  UDP/5353) und ist **nur für den Main-Prozess** gedacht.

### API

```ts
import { advertise, discover } from '@jm/discovery';

// Quelle: sich selbst bekannt machen
const ad = advertise({ appId: 'jm-timer', role: 'timer', port: 7777 });
// … beim Beenden / Abschalten:
ad.stop();

// Aggregator: andere finden
const sub = discover((services) => {
  // services: { appId, role, host, port, name }[]
});
sub.stop();
```

---

## 2. Wer annonciert sich — und wann

Annonciert wird **nur, solange der zugehörige Server/Remote tatsächlich läuft**.
So ist „im LAN sichtbar" gleichbedeutend mit „erreichbar". Beim Stoppen/Beenden
wird die Annoncierung wieder zurückgezogen.

| Tool | Rolle (`role`) | Port | Gekoppelt an … | Quelle |
|---|---|---|---|---|
| **Timer** | `timer` | 7777 | läuft immer (Server startet mit der App) | [apps/timer/src/main/index.ts](../apps/timer/src/main/index.ts) |
| **Presenter** | `presenter` | 7330 | Fernsteuerung (Remote-Server) eingeschaltet | [apps/presenter/src/main/remote.ts](../apps/presenter/src/main/remote.ts) |
| **Prompter** | `prompter` | 7781 | Fernbedienung eingeschaltet | [apps/prompter/src/main/index.ts](../apps/prompter/src/main/index.ts) |
| **Switcher** | `switcher` | 8723¹ | TCP-Steuerserver läuft | [apps/switcher/src/main/control-server.ts](../apps/switcher/src/main/control-server.ts) |

¹ Standard-Steuerport (`DEFAULT_CONTROL_PORT`); annonciert wird der tatsächlich
gebundene Port.

**Lebenszyklus-Kopplung im Detail:**

- **Presenter:** `advertise(...)` im `listen`-Callback von `applyRemoteConfig`,
  `advertiser.stop()` in `stopServer()`. Jeder Apply-Zyklus annonciert mit dem
  dann gültigen Port neu.
- **Prompter:** `setAdvertised(true/false)` hängt an `setRemote(enabled)` und am
  `before-quit`. Idempotent.
- **Switcher:** `advertise(...)` im `listen`-Callback von `startControlServer`,
  `advertiser.stop()` in `stopControlServer()`.

---

## 3. Wer konsumiert — und die Gate-Logik

**Stage Display** (`discover()` beim Start) wertet Funde in `onDiscovered` aus
([apps/stage-display/src/main/index.ts](../apps/stage-display/src/main/index.ts)).
Für **jede** Quelle (Timer/Switcher/Presenter) gilt dieselbe Bedingung, bevor
der entdeckte Host übernommen wird:

```
Quelle ist in der Config aktiviert
  UND aktuell NICHT verbunden
  UND der entdeckte Host ist ein anderer als der konfigurierte
→ Host/Port aus dem Fund übernehmen, neu verbinden
```

Das bedeutet:

- Eine **bereits stehende** Verbindung (z. B. lokal über `127.0.0.1`) wird
  **nie** umgebogen.
- Eine **deaktivierte** Quelle wird **nicht** aktiviert — Discovery füllt nur
  Adressen, sie schaltet keine Widgets ein.
- **Auth bleibt manuell:** die Presenter-**PIN** wird nicht über mDNS verteilt.
  Discovery liefert nur die Adresse.

> Der Prompter annonciert sich zwar, hat aber (noch) keinen Konsumenten im
> Stage Display — es gibt dort kein Prompter-Widget. Die Annoncierung ist für
> Sichtbarkeit/künftige Nutzung dennoch vorhanden.

---

## 4. Verpackung (Packaging)

Gepackte Apps liefern **kein** `node_modules` aus (nur `out/** + package.json`).
Deshalb wird `@jm/discovery` **inklusive** seiner Transitiv-Dep `bonjour-service`
in den Main-Bundle gebündelt, statt zur Laufzeit `require`d zu werden. In jeder
annoncierenden/konsumierenden App ist dafür in der `electron.vite.config.ts`
sowohl `@jm/discovery` als auch `bonjour-service` in die `exclude`-Liste von
`externalizeDepsPlugin` aufgenommen.

**Verifikation** (nach `npm run build`): Im jeweiligen `out/main/index.cjs` muss
der mDNS-Port `5353` auftauchen und es darf **kein** `require('bonjour-service')`
übrig sein (sonst wäre es externalisiert statt gebündelt).

---

## 5. Stand & offene Punkte

**Erledigt (B5 + Erweiterung):**

- `@jm/discovery` als verallgemeinertes mDNS-Paket (aus dem
  `studio-control`-Muster).
- Timer, Presenter, Prompter, Switcher annoncieren sich an ihren jeweiligen
  Server-Lebenszyklus gekoppelt.
- Stage Display konsumiert Timer-, Switcher- und Presenter-Funde.
- Typecheck/Build/Bundle aller vier Apps grün; `bonjour-service` nachweislich
  gebündelt.

**Noch offen / bewusst nicht gemacht:**

- **Netz-Smoke-Test über zwei Rechner** steht aus (headless nicht testbar):
  Quelle auf Rechner A starten → Stage Display auf Rechner B verbindet ohne
  IP-Eingabe. Voraussetzung: gleiches Subnetz, mDNS/UDP 5353 nicht durch
  Firewall blockiert.
- **Entdeckte Quellen in der Stage-Config-UI sichtbar machen** (Auswahlliste
  „gefundene Timer/Switcher/Presenter"): bisher füllt Discovery den Host nur im
  Hintergrund, zeigt die Funde aber nicht in der Oberfläche an.
- **Prompter-Konsument:** Stage Display hat kein Prompter-Widget; der Prompter
  annonciert sich, wird aber nicht ausgewertet.
