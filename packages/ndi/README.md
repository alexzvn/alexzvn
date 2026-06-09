# @jm/ndi

Natives N-API-Addon für **NDI-Versand und -Empfang** (Send + Receive) der JM
Production Suite. **Send** genutzt von **JM NDI Screen Capture** (Bildschirm →
NDI). **Receive** ist die Grundlage für den **JM Switcher** (NDI-Input) und die
NDI-PGM-Vorschau in JM Studio Control.

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

## Receive-Spike (Switcher-Vorbereitung)

Einen Sender laufen lassen (NDI Studio Monitor → *Test Pattern*, oder die JM NDI
Screen Capture), dann:
```powershell
npm run spike:recv -w @jm/ndi
# bestimmte Quelle:
node packages/ndi/test/recv-spike.cjs "HOST (Quellenname)"
```
Erwartung: gefundene Quellen werden gelistet, und nach dem Verbinden zählt der
Spike > 0 Video-Frames mit plausibler Auflösung (BGRA). Damit ist der
Receive-Pfad bewiesen, bevor der Switcher-Input angedockt wird.

`receive(timeoutMs)` ist synchron/pollend — im echten Tool in einer Schleife im
utilityProcess aufrufen und die Frames (Copy) per Port an den Renderer-Compositor
reichen (Copy-not-transfer-Disziplin wie bei der Screen Capture).

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

// Send
createSender(name: string): void
sendVideoBGRA(buf: Uint8Array, w: number, h: number, fpsN?, fpsD?): void
sendAudioFLTP(planar: Float32Array, channels: number, samples: number, sampleRate?): void
connections(timeoutMs?): number

// Receive
findSources(timeoutMs?): string[]
createReceiver(sourceName: string): boolean
receive(timeoutMs?): NdiFrame | null   // { type:'video', data:Buffer(BGRA), width, height, lineStride, fourCC, fpsN, fpsD }
                                       // | { type:'audio', data:Float32Array(FLTP), channels, samples, sampleRate }
closeReceiver(): void

destroy(): void
```
