# Release-Runbook: JM Caption (nativ, Office-Build)

JM Caption ist **nativ** (whisper.cpp-CLI + Basismodell, @jm/ndi-Addon + NDI-Runtime-DLL)
und wird daher — wie Titler, Recorder, Transcribe, DAW, NDI Screen Capture — **lokal im
Büro auf Windows** gebaut. Die CI (`suite-release.yml`) überspringt das Tool (Tag-Präfix
`caption-v`). Code liegt auf Branch `feat/caption`.

> ⚠️ **Reihenfolge ist Pflicht** (Memory `launcher-catalog-publishing` /
> `changelog-json-quote-trap`): Der Proxy liest den Katalog **live von `main`**. Erst muss
> das GitHub-Release `caption-v0.1.0` mit der `.exe` existieren, **dann** darf der
> Katalog-Eintrag nach `main` (Merge von `feat/caption`). Niemals umgekehrt — sonst zeigt
> der Launcher einen kaputten Download. Der Katalog-Eintrag + Changelog liegen bereits auf
> `feat/caption` vorbereitet (`packages/suite-manifest/suite.json` + `changelog.json`).

## Voraussetzungen (einmalig)

- Windows-Rechner mit installiertem **NDI-SDK** (für `Processing.NDI.Lib.x64.dll`).
- **whisper.cpp**-Windows-Build (`whisper-cli.exe` + DLLs, z. B. aus `whisper-bin-x64`).
- **Basismodell** `ggml-base.bin` (lokal abgelegt).
- Gebautes natives Addon **`@jm/ndi`** → `packages/ndi/build/Release/jm_ndi.node`
  (entsteht beim `npm install` über `scripts/maybe-build.mjs`; bei Bedarf
  `npm run rebuild --workspace @jm/ndi` mit passendem Electron-Header, gleicher Ablauf wie
  bei Titler / NDI Screen Capture).
- `gh` CLI angemeldet (`gh auth status`).

## Build + Release

```powershell
git checkout feat/caption
git pull

# Umgebungsvariablen für die Bundle-Skripte (prepackage):
$env:NDI_SDK_DIR     = "C:\Program Files\NDI\NDI 6 SDK"        # enthält Bin\x64\Processing.NDI.Lib.x64.dll
$env:WHISPER_DIR     = "C:\tools\whisper-bin-x64"             # whisper-cli.exe + DLLs
$env:WHISPER_MODEL_BASE = "C:\tools\models\ggml-base.bin"     # Basismodell

# Baut Renderer/Main/Preload (+ ndi-sender.cjs), staged whisper + ffmpeg + NDI,
# packt die NSIS-.exe:
npm run dist:win --workspace @jm/caption
# Ergebnis: apps/caption/release/JM Caption-0.1.0-win-x64.exe
```

`dist:win` = `electron-vite build` → `prepackage` (`bundle-whisper.mjs` +
`bundle-ndi.mjs`) → `electron-builder --win`.

### GitHub-Release (Binary MUSS zuerst existieren)

```powershell
gh release create caption-v0.1.0 `
  "apps/caption/release/JM Caption-0.1.0-win-x64.exe" `
  --title "JM Caption 0.1.0" `
  --notes "Live-Untertitel via whisper.cpp als transparente NDI-Quelle. Per Companion steuerbar (Transkription, Hold, NDI)."
```

Artefaktname muss exakt zum Katalog passen: `JM Caption-${version}-win-x64.exe`
→ `JM Caption-0.1.0-win-x64.exe`. Kurz prüfen, dass der Release-Asset-Download zieht.

### Katalog veröffentlichen (erst NACH dem Release)

```powershell
# Eintrag/Changelog liegen schon auf feat/caption → Merge publiziert den Katalog:
git checkout main
git merge --no-ff feat/caption
git push
# latestVersion ist bereits 0.1.0; ein Bump ist No-Op, schadet aber nicht:
node scripts/bump-manifest.mjs caption 0.1.0
```

Danach im Launcher prüfen: **JM Caption** erscheint unter **Studio** mit Patch-Notes;
Download/Install funktioniert.

## Companion (separat, Office-Standalone-Checkout)

Das generische Modul `companion-jm-suite` kennt die Rolle `caption` bereits (regeneriert via
`scripts/sync-companion-protocol.mjs`). Caption annonciert seinen Steuerendpunkt per mDNS als
`jm-caption-ctl` (TXT `ctl=1`, Port **8732**) → erscheint automatisch in Companion. Actions:
`transcribe on|off|toggle`, `hold on|off|toggle`, `ndi on|off|toggle`, `clear`; Feedbacks für
Transkription/Hold/NDI; Variablen `running/hold/ndi/connections/lines`.

## Smoke-Test (im Büro)

1. Caption starten → Mikrofon erlauben → **● Start**: Pegel schlägt aus, nach Sprechpausen
   erscheinen Untertitelzeilen (echte Transkription, da Binary + Modell jetzt gebündelt).
2. **NDI starten** → in NDI Studio Monitor / vMix / OBS die Quelle `JM Caption` öffnen:
   transparenter Untertitel unten, folgt dem Gesprochenen.
3. **Hold** → NDI-Ausgabe friert auf der letzten Zeile ein, neue Transkripte erst nach Lösen.
4. `telnet <host> 8732` → `CAPTION hold on` friert ein, `CAPTION ndi off` stoppt NDI,
   `CAPTION clear` leert; `STATE?` liefert `STATE ns=caption running=… hold=… ndi=… …`.
5. Companion: Tool erscheint per mDNS, Buttons schalten, Feedback-Farben stimmen.
