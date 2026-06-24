# Welle 4 — ATEM + OBS in JM Studio Control

Zwei neue Geräte-Treiber in `apps/studio-control`, exakt nach dem bestehenden
Treibermuster (Tricaster/PTZ): `client.ts` + `pool.ts` + `config/<x>.ts` +
`shared/<x>.ts` (zod) + Server-Verdrahtung (REST `/api/atem`, `/api/obs` +
Socket.IO `atem:exec`/`obs:exec` + `atem:state`/`obs:state`) + Renderer-Panel.
Branch `feat/studio-atem-obs` (von main).

## Was funktioniert (hier verifiziert)

- **typecheck node+web grün**, **electron-vite-Build grün** — die Library-Nutzung
  (atem-connection v3, obs-websocket-js v5) ist gegen die echten Typen geprüft.
- **OBS-Bridge** (`obs-websocket-js`, rein JS): verbindet per ws://host:port
  (+ optionalem Passwort), event-getrieben (Szenenwechsel/Record/Stream), Auto-
  Reconnect. Steuerung: Szene setzen, Aufnahme/Stream an/aus (Toggle). Status:
  aktuelle Szene, Szenenliste, recording/streaming.
- **ATEM-Treiber** (`atem-connection`): verbindet per UDP 9910, M/E 1. Steuerung:
  Program-/Preview-Eingang, Cut, Auto, FTB, Upstream-Keyer, Record/Stream. Status:
  Modell, Program/Preview, recording/streaming.
- **Renderer:** `AtemPanel` + `ObsPanel` unter Video (Instanz anlegen/bearbeiten/
  entfernen, Live-Steuerung, Statusanzeige). Rollen: `atem:exec`/`obs:exec`
  (operator), `*:read` (viewer); CRUD via `inventory:write`.

## Was das Büro verifizieren MUSS (Hardware + nativer Build)

1. **ATEM gegen echte Hardware** (oder ATEM Software Control / mini): Program/
   Preview/Cut/Auto/FTB/REC/Stream + Statusrückmeldung. UDP 9910 erreichbar.
2. **OBS gegen echtes OBS**: WebSocket-Server in OBS aktivieren (Werkzeuge →
   WebSocket-Server-Einstellungen), Port/Passwort eintragen; Szenenwechsel +
   Record/Stream prüfen.
3. **⚠️ Nativer Build (kritisch):** `atem-connection` zieht `@julusian/freetype2`
   (natives Addon) als harte Dependency. studio-control rebuildet bisher nur
   better-sqlite3 — jetzt ist `@julusian/freetype2` ergänzt:
   - `package.json` postinstall + `rebuild:native`: `electron-rebuild --only
     better-sqlite3,@julusian/freetype2`.
   - `electron-builder.yml` asarUnpack: `**/node_modules/@julusian/**`.
   - **Prüfen:** Im gepackten Build muss `require('atem-connection')` laden, d. h.
     freetype2 muss als **Electron-ABI**-Binary vorliegen (Prebuild oder Rebuild).
     Falls electron-rebuild es nicht baut (pkg-prebuilds-Modul) und kein Electron-
     Prebuild existiert → ATEM aus studio-control wieder herauslösen oder
     atem-connection-Version anpassen. OBS ist davon unbetroffen (rein JS).
4. **CI-Build:** Den `studio-control-v…`-Tag-Build der GitHub-Action beobachten
   (rebuild + Packen müssen durchlaufen), bevor released wird.

## Bewusst zurückgestellt

- **Companion/`@jm/suite-control-protocol`-Exposition:** studio-control nutzt aktuell
  REST+Socket.IO (Port 7778), nicht das Suite-Steuerprotokoll. ATEM/OBS sind darüber
  steuerbar; eine zusätzliche Companion-Bridge (Gateway) ist eine eigene Welle-5-
  Aufgabe (Roadmap „Gateway-Option").

## Release (nach Office-Verifikation)

studio-control ist CI-baubar (Tag `studio-control-v<version>`). Version in
`package.json` bumpen, taggen → CI baut + released; danach suite.json-`latestVersion`
via `node scripts/bump-manifest.mjs studio-control <version>` (oder CI-Auto-Bump)
+ Changelog-Eintrag.
