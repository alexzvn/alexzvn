# @jm/ndi

Natives N-API-Addon für den **NDI-Versand** (Send) der JM Production Suite.
Genutzt von **JM NDI Screen Capture** (Bildschirm → NDI). Receive-Bindings für
die NDI-PGM-Vorschau in JM Studio Control kommen später hier dazu.

> Baubar **nur auf Windows/Mac mit installiertem NDI-SDK**. Ohne `NDI_SDK_DIR`
> überspringt `npm install` den nativen Build (Guard), damit Linux/CI nicht bricht.

## Bauen (Windows x64)

1. NDI-SDK installieren (NDI 5/6) + Lizenz akzeptieren → z. B.
   `C:\Program Files\NDI\NDI 6 SDK`.
2. „Desktop development with C++" (VS Build Tools) + Python 3 (für node-gyp).
3. Umgebungsvariable setzen:
   ```powershell
   setx NDI_SDK_DIR "C:\Program Files\NDI\NDI 6 SDK"
   ```
   (neue Shell öffnen, damit die Variable greift)
4. Bauen:
   ```powershell
   npm install                      # im Repo-Root (baut @jm/ndi via Guard)
   # oder gezielt:
   npm run rebuild -w @jm/ndi
   ```

## Phase-1-Spike (Sanity-Check)

```powershell
node packages/ndi/test/spike.cjs
```
Dann **NDI Studio Monitor** öffnen → Quelle `JM Capture (<host>) - Test Pattern`
muss mit bewegtem Bild + 440-Hz-Ton erscheinen. Das beweist Build + ABI +
DLL-Load + Send, bevor die echte Capture-Pipeline angedockt wird.

## Einsatz in Electron

Für den Betrieb im App-/utilityProcess gegen die Electron-ABI rebuilden:
```powershell
npx electron-rebuild --only @jm/ndi
```
Die Runtime-DLL (`Processing.NDI.Lib.x64.dll`) wird beim Packaging gebündelt
(siehe `apps/ndi-screen-capture/tools/bundle-ndi.mjs` und
`apps/ndi-screen-capture/docs/phase1-native-ndi-windows.md`).

## API

```ts
init(): boolean
createSender(name: string): void
sendVideoBGRA(buf: Uint8Array, w: number, h: number, fpsN?, fpsD?): void
sendAudioFLTP(planar: Float32Array, channels: number, samples: number, sampleRate?): void
connections(timeoutMs?): number
destroy(): void
```
