# Welle 5 — Studio-Control Companion-Gateway

Studio Control exponiert seine Gerätetreiber jetzt **zusätzlich** über das suite-
weite TCP-Zeilenprotokoll (`@jm/suite-control-protocol`) an **Bitfocus Companion**
— neben dem bestehenden REST-/Socket.IO-Pfad (Port 7778). Damit ist der ganze
Studio-Hub aus Companion fernsteuerbar, und **jeder Gateway-Befehl landet zentral
im Audit-Log** („zentral-auditierte Steuerung", Roadmap Welle 5 „Gateway-Option").

Branch `feat/studio-gateway` (von `feat/studio-atem-obs`/Welle 4 — enthält also
ATEM/OBS-Treiber **und** das Gateway). Commits: `40040cc9e2` (Slice 1
ATEM/OBS/TriCaster), `c8f6feddd1` (Slice 2 PTZ/Audio/Licht).

## Architektur

- **Eine Rolle `studio`** (Port **8735**), `controlEndpoint:true` → mDNS-Advert
  `_jmps._tcp` mit TXT `ctl=1`, Instanzname `jm-studio-control-ctl`. studio-control
  hat sonst keinen mDNS-Advert → keine Namenskollision. Das generische Companion-
  Modul `companion-jm-suite` findet den Endpunkt automatisch (Auto-Discovery).
- studio-control ist ein **Geräte-Hub**; das Protokoll-/Companion-Modell ist
  „eine Rolle = ein logisches Gerät mit flachem Verb-Set". Wir bündeln daher alle
  Gerätetypen in der Rolle `studio` mit **typ-präfixierten Verben** und bedienen je
  Typ die **PRIMÄR-Instanz** (die erste konfigurierte). Mehrinstanz-Adressierung
  (mehrere ATEMs etc.) ist eine spätere Ausbaustufe.
- **Auth/Audit:** Das TCP-Zeilenprotokoll kennt keinen Token-Handshake (Companion
  nutzt `TCPHelper` ohne Auth — wie alle Suite-Steuerports im vertrauenswürdigen
  Produktions-LAN). Das Gateway handelt unter der festen Dienst-Identität
  `companion-gateway`; **jeder Befehl** wird per `logAction()` protokolliert
  (`gateway:<verb>` bzw. `…:failed`, mit Ziel-Geräte-ID + Payload). Die
  Nachvollziehbarkeit liefert das Audit-Log (im UI unter Audit sichtbar).
- Code: `src/main/gateway/control-gateway.ts`; in `server.ts` im `http.listen`-
  Callback fehlertolerant gestartet, in `stopServer()` gestoppt.

## Companion-Actions (Rolle „JM Studio Control")

| Verb | Wirkung | Primär-Instanz |
|---|---|---|
| `atem_program <n>` / `atem_preview <n>` | M/E-1 Program/Preview-Eingang | ATEM |
| `atem_cut` / `atem_auto` / `atem_ftb` | Cut / Auto / Fade-to-Black | ATEM |
| `atem_record on\|off` / `atem_stream on\|off` | Aufnahme / Stream | ATEM |
| `obs_scene <n>` | Szene per 1-basiertem Index | OBS |
| `obs_record on\|off` / `obs_stream on\|off` | Aufnahme / Stream | OBS |
| `tricaster_shortcut <name>` | LiveControl-Shortcut/Makro (Token, z. B. `main_take`) | TriCaster |
| `ptz_preset <n>` | Preset abrufen (0–99) | PTZ |
| `ptz_power on\|off\|toggle` | Kamera Power | PTZ |
| `audio_mute <ch> on\|off` | Kanal stummschalten | Audiopult |
| `audio_fader <ch> <db>` | Kanal-Fader auf dB | Audiopult |
| `lighting_blackout on\|off\|toggle` | Art-Net-Blackout | Licht |

**Feedbacks** (Button-Farben): ATEM Program/Preview-Eingang (equals), ATEM/OBS
Aufnahme+Stream, OBS Szene aktiv (equals), PTZ Power, Licht-Blackout.
**Variablen:** Verbindungs-Flags + Modell/Name je Typ, ATEM pgm/pvw, OBS Szene
(Nr.+Name), PTZ Power, Blackout. (Toggle-Auflösung: Companion liest den jeweiligen
STATE-Schlüssel; `audio_mute` ist bewusst on/off ohne Toggle, da der Pult-Status
keine Kanal-Mutes führt.)

## Smoke-Test (im Büro)

> Voraussetzung: mindestens je ein Gerät in Studio Control konfiguriert (Video-
> Ansicht). Das Gateway bedient die **erste** konfigurierte Instanz je Typ.

1. studio-control starten → Log-Zeile
   `companion gateway listening on tcp://0.0.0.0:8735`.
2. `telnet <host> 8735` → sofort kommt eine `STATE ns=studio …`-Zeile.
   - `STATE?` → aktueller Zustand.
   - `STUDIO atem_cut` → ATEM schneidet; `STUDIO obs_scene 2` → OBS-Szene 2;
     `STUDIO lighting_blackout on` → Blackout; `STUDIO ptz_preset 1` → Preset 1.
   - Bei jeder realen Statusänderung wird eine neue `STATE`-Zeile gepusht.
3. **Audit:** Im Studio-Control-UI unter *Audit* erscheinen die Befehle als
   `gateway:atem_cut` etc. (User `companion-gateway`).
4. **Companion:** `companion-jm-suite` laden → Modus *Automatisch (mDNS)* →
   „JM Studio Control" erscheint → Buttons schalten die Geräte, Feedback-Farben
   (Program-Eingang, REC, Blackout …) stimmen.

## Release (nach Office-Verifikation)

`feat/studio-gateway` enthält **Welle 4 + Welle 5**. Vor einem Release gilt
weiterhin die Welle-4-Auflage (`docs/welle-4-atem-obs.md`):

1. **Nativer Build (kritisch, unverändert):** `atem-connection` zieht
   `@julusian/freetype2` (natives Addon). `postinstall`/`rebuild:native` baut
   `better-sqlite3,@julusian/freetype2`; `asarUnpack: **/node_modules/@julusian/**`.
   Prüfen, dass `require('atem-connection')` im gepackten Build lädt.
2. **Hardware-Tests** ATEM/OBS/PTZ/Audio/Licht (echte Geräte oder Mocks
   `npm run mock:*`).
3. **Gateway-Smoke-Test** (oben) + Companion end-to-end.
4. Release: `feat/studio-gateway` → main mergen, `studio-control`-Version bumpen
   (`package.json`, z. B. 0.5.0 → 0.6.0), Tag `studio-control-v<version>` → CI
   baut + released (CI baut studio-control regulär; das native Addon ist der
   einzige Risikopunkt). Danach `node scripts/bump-manifest.mjs studio-control
   <version>` + Changelog-Eintrag.

## Bewusst (noch) offen

- **Mehrinstanz-Adressierung:** aktuell Primär-Instanz je Typ. Mehrere ATEMs/OBS
  per Instanz-Argument adressierbar zu machen ist eine eigene Ausbaustufe (dann
  am besten als dynamische Instanz-Dropdowns im Companion-Modul).
- PTZ Pan/Tilt/Zoom (kontinuierlich, Joystick) bewusst nicht als Buttons —
  Presets + Power decken den Companion-Anwendungsfall ab.
