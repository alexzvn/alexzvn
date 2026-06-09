# JM NDI Screen Capture — Windows-Übergabe: nativer NDI-Versand (Phase 1, 3, 4)

Diese Anleitung führt vom aktuellen Stand (Phase 0 + 2, **fertig & verifiziert**)
zum funktionierenden NDI-Sender. Alle Schritte hier brauchen **Windows x64 + das
lizenzierte NDI-SDK** und lassen sich **nicht** im Linux-Codespace ausführen.

---

## 0. Aktueller Stand (was schon da & geprüft ist)

- App-Gerüst nach Suite-Konventionen: `window.jmndi`, Port 5180, appId
  `gmbh.jakobs.ndi-screen-capture`, in `packages/suite-manifest/suite.json` +
  Root-Aliassen (`ndi:dev/build/dist`) registriert.
- **Renderer-Capture-Pipeline läuft** (im Codespace verifiziert):
  - `src/main/sources.ts` → `desktopCapturer.getSources()` → `JmNdiSource[]`
  - `src/main/capture-handler.ts` → `setDisplayMediaRequestHandler` liefert die
    gewählte Quelle (System-Audio `audio:'loopback'` nur unter Windows).
  - `src/renderer/src/core/capture.ts` → `CaptureSession`:
    `getDisplayMedia` → `MediaStreamTrackProcessor` → `VideoFrame`, FPS-Cap,
    striktes `frame.close()`. **Sink ist aktuell die lokale Canvas-Vorschau**
    (`App.tsx` → `drawFrame`).
  - UI: `SourcePicker`, `Preview`, `StatusBar`.
- Verifiziert per Probe: Quelle kommt als **I420**, `VideoFrame.copyTo({format:'BGRA'})`
  liefert exakt `w*h*4` Byte — genau der Buffer, den das native Addon bekommt.

**Aufgabe hier:** an der Stelle `onFrame` (Renderer) den Frame als BGRA in einen
Buffer kopieren und an einen `utilityProcess` mit nativem NDI-Sender übertragen,
statt (nur) auf den Canvas zu zeichnen.

---

## 1. Voraussetzungen (einmalig auf dem Windows-Build-PC)

1. **Windows 10/11 x64**, Node 20.x (gleiche Major wie im Repo).
2. **NDI SDK** (NDI 5 oder 6) von <https://ndi.video/for-developers/ndi-sdk/> —
   Installer ausführen, **NDI-SDK-Lizenz akzeptieren**. Danach existiert z. B.
   `C:\Program Files\NDI\NDI 6 SDK\` mit `Include\`, `Lib\x64\`, `Bin\x64\`.
3. **NDI Tools** (für `NDI Studio Monitor` als Empfänger zum Testen).
4. **Build-Toolchain für native Module:** „Desktop development with C++"
   (Visual Studio Build Tools) + Python 3 — wird von `node-gyp` gebraucht.
5. Umgebungsvariable setzen (PowerShell, dauerhaft):
   ```powershell
   setx NDI_SDK_DIR "C:\Program Files\NDI\NDI 6 SDK"
   ```

> **Hinweis:** SDK-Header/Libs sind **nicht** als Quelle redistribuierbar und
> dürfen **nicht eingecheckt** werden. Nur die Runtime-DLL
> `Processing.NDI.Lib.x64.dll` wird (Schritt 6) in den Installer gebündelt.

---

## 2. Natives Paket `packages/ndi` anlegen

### `packages/ndi/package.json`
```json
{
  "name": "@jm/ndi",
  "version": "0.1.0",
  "private": true,
  "description": "Native NDI-Bindings (send) für die JM Production Suite",
  "main": "index.js",
  "types": "index.d.ts",
  "gypfile": true,
  "scripts": {
    "install": "node-gyp rebuild"
  },
  "dependencies": {
    "node-addon-api": "^8.0.0",
    "bindings": "^1.5.0"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0"
  }
}
```

### `packages/ndi/binding.gyp`
```python
{
  "targets": [
    {
      "target_name": "jm_ndi",
      "sources": ["src/addon.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!(node -e \"process.stdout.write(process.env.NDI_SDK_DIR + '/Include')\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "<!(node -e \"process.stdout.write(process.env.NDI_SDK_DIR + '/Lib/x64/Processing.NDI.Lib.x64.lib')\")"
          ]
        }]
      ]
    }
  ]
}
```

### `packages/ndi/src/addon.cc` (Send-Skelett — Spike: BGRA-Video + FLTP-Audio)
```cpp
#include <napi.h>
#include <Processing.NDI.Lib.h>
#include <string>

namespace {
NDIlib_send_instance_t g_send = nullptr;

Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!NDIlib_initialize()) {
    Napi::Error::New(env, "NDIlib_initialize fehlgeschlagen (Runtime?)").ThrowAsJavaScriptError();
    return env.Undefined();
  }
  return Napi::Boolean::New(env, true);
}

// createSender(name: string)
Napi::Value CreateSender(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::string name = info[0].As<Napi::String>();
  NDIlib_send_create_t desc;
  desc.p_ndi_name = name.c_str();
  desc.clock_video = true;   // NDI taktet das Video
  desc.clock_audio = false;
  g_send = NDIlib_send_create(&desc);
  if (!g_send) {
    Napi::Error::New(env, "NDIlib_send_create fehlgeschlagen").ThrowAsJavaScriptError();
    return env.Undefined();
  }
  return env.Undefined();
}

// sendVideoBGRA(buf: Buffer, width, height, fpsN=30, fpsD=1)
Napi::Value SendVideoBGRA(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_send) return env.Undefined();
  Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
  int w = info[1].As<Napi::Number>().Int32Value();
  int h = info[2].As<Napi::Number>().Int32Value();
  int fpsN = info.Length() > 3 ? info[3].As<Napi::Number>().Int32Value() : 30;
  int fpsD = info.Length() > 4 ? info[4].As<Napi::Number>().Int32Value() : 1;

  NDIlib_video_frame_v2_t frame;
  frame.xres = w;
  frame.yres = h;
  frame.FourCC = NDIlib_FourCC_type_BGRA;
  frame.frame_rate_N = fpsN;
  frame.frame_rate_D = fpsD;
  frame.picture_aspect_ratio = (float)w / (float)h;
  frame.frame_format_type = NDIlib_frame_format_type_progressive;
  frame.timecode = NDIlib_send_timecode_synthesize;
  frame.p_data = buf.Data();
  frame.line_stride_in_bytes = w * 4;
  // Synchrone Variante: kopiert intern → Buffer darf danach sofort freigegeben werden.
  NDIlib_send_send_video_v2(g_send, &frame);
  return env.Undefined();
}

// sendAudioFLTP(planar: Float32Array, channels, samples, sampleRate=48000)
Napi::Value SendAudioFLTP(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_send) return env.Undefined();
  Napi::Float32Array a = info[0].As<Napi::Float32Array>();
  int ch = info[1].As<Napi::Number>().Int32Value();
  int n = info[2].As<Napi::Number>().Int32Value();
  int sr = info.Length() > 3 ? info[3].As<Napi::Number>().Int32Value() : 48000;

  NDIlib_audio_frame_v3_t audio;
  audio.sample_rate = sr;
  audio.no_channels = ch;
  audio.no_samples = n;
  audio.timecode = NDIlib_send_timecode_synthesize;
  audio.FourCC = NDIlib_FourCC_audio_type_FLTP;
  audio.p_data = (uint8_t*)a.Data();           // planar: [ch0 n samples][ch1 n samples]...
  audio.channel_stride_in_bytes = n * sizeof(float);
  NDIlib_send_send_audio_v3(g_send, &audio);
  return env.Undefined();
}

// connections(): number  (NDIlib_send_get_no_connections)
Napi::Value Connections(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_send) return Napi::Number::New(env, 0);
  return Napi::Number::New(env, NDIlib_send_get_no_connections(g_send, 0));
}

Napi::Value Destroy(const Napi::CallbackInfo& info) {
  if (g_send) { NDIlib_send_destroy(g_send); g_send = nullptr; }
  NDIlib_destroy();
  return info.Env().Undefined();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("createSender", Napi::Function::New(env, CreateSender));
  exports.Set("sendVideoBGRA", Napi::Function::New(env, SendVideoBGRA));
  exports.Set("sendAudioFLTP", Napi::Function::New(env, SendAudioFLTP));
  exports.Set("connections", Napi::Function::New(env, Connections));
  exports.Set("destroy", Napi::Function::New(env, Destroy));
  return exports;
}
}  // namespace

NODE_API_MODULE(jm_ndi, InitAll)
```

### `packages/ndi/index.js`
```js
const bindings = require('bindings');
module.exports = bindings('jm_ndi');
```

### `packages/ndi/index.d.ts`
```ts
export function init(): boolean;
export function createSender(name: string): void;
export function sendVideoBGRA(buf: Uint8Array, width: number, height: number, fpsN?: number, fpsD?: number): void;
export function sendAudioFLTP(planar: Float32Array, channels: number, samples: number, sampleRate?: number): void;
export function connections(): number;
export function destroy(): void;
```

### `packages/ndi/.gitignore`
```
build/
*.node
```

> Das Paket ist als npm-Workspace-Mitglied (`packages/*`) automatisch verlinkt.

---

## 3. Bauen & für die Electron-ABI rebuilden

```powershell
# im Repo-Root
npm install                      # baut @jm/ndi gegen System-Node
# danach gegen die Electron-33-ABI rebuilden (wie better-sqlite3 in studio-control):
npm exec --workspace @jm/ndi -- electron-rebuild --only @jm/ndi
```

In `apps/ndi-screen-capture/package.json` ergänzen (Muster: studio-control):
```json
"dependencies": { "@jm/ndi": "*", ... },
"scripts": {
  "postinstall": "electron-rebuild --only @jm/ndi || exit 0",
  "rebuild:native": "electron-rebuild --only @jm/ndi"
}
```
und `@electron/rebuild` als devDependency hinzufügen.

**Erst-Spike (Phase 1, vor jeder Pipeline-Arbeit):** ein kleines Skript schreiben,
das `init()`, `createSender('JM Capture (Test)')` aufruft und in einer Schleife ein
synthetisches BGRA-Testbild (+ Sinuston via `sendAudioFLTP`) sendet. **Exit-Kriterium:**
Quelle erscheint in **NDI Studio Monitor**. Das beweist Build + ABI + DLL-Load +
Send-Semantik, bevor die echte Pipeline angedockt wird.

---

## 4. utilityProcess-Sender + Main-Wiring (Phase 4)

### `apps/ndi-screen-capture/src/utility/ndi-sender.ts` (Entry des utilityProcess)
```ts
import ndi from '@jm/ndi';

let port: Electron.MessagePortMain | null = null;

process.parentPort.once('message', (e) => {
  port = e.ports[0];
  port.on('message', (msg) => {
    const { type } = msg.data ?? {};
    if (type === 'start') {
      ndi.init();
      ndi.createSender(msg.data.name);
    } else if (type === 'video') {
      // msg.data.buffer ist ein transferierter ArrayBuffer (BGRA)
      ndi.sendVideoBGRA(new Uint8Array(msg.data.buffer), msg.data.w, msg.data.h, msg.data.fpsN, 1);
    } else if (type === 'audio') {
      ndi.sendAudioFLTP(new Float32Array(msg.data.buffer), msg.data.ch, msg.data.n, msg.data.sr);
    } else if (type === 'stop') {
      ndi.destroy();
    }
  });
  port.start();
});
```

### `apps/ndi-screen-capture/src/main/ndi/sender-process.ts`
```ts
import { utilityProcess, MessageChannelMain, type BrowserWindow } from 'electron';
import { join } from 'node:path';

let child: Electron.UtilityProcess | null = null;

export function startSender(win: BrowserWindow, name: string): void {
  child = utilityProcess.fork(join(__dirname, '../utility/ndi-sender.mjs'));
  const { port1, port2 } = new MessageChannelMain();
  // Ein Ende an den utilityProcess …
  child.postMessage({ type: 'init' }, [port2]);
  // … das andere Ende an den Renderer, der die Frames sendet.
  win.webContents.postMessage('jmndi:frame-port', { name }, [port1]);
}

export function stopSender(): void {
  child?.kill();
  child = null;
}
```

> `utilityProcess.fork` braucht den gebauten Entry — den utility-Build in
> `electron.vite.config.ts` als zusätzlichen Einstiegspunkt ergänzen
> (analog zu `main`/`preload`, Ausgabe nach `out/utility/ndi-sender.mjs`).
> `@jm/ndi` im utility-Build **nicht** externalisieren bzw. korrekt als externes
> `require` behandeln, damit die `.node`-Datei zur Laufzeit gefunden wird.

`registerIpc`/`start` so erweitern, dass beim Start `startSender(win, ndiSourceName)`
aufgerufen wird und `stop` `stopSender()` ruft; Status `sendState`/`connections`
aus dem utilityProcess zurückmelden.

---

## 5. Renderer: Frames statt Canvas an den Sender übertragen

In `App.tsx`/`capture.ts` den `onFrame`-Konsumenten erweitern: zusätzlich zum
(optionalen) Canvas-Preview den Frame als **BGRA** kopieren und über den
empfangenen `MessagePort` **transferable** posten.

```ts
// Port aus dem Main empfangen:
let framePort: MessagePort | null = null;
window.jmndi /* via preload */; // ipcRenderer.on('jmndi:frame-port', (e)=> framePort = e.ports[0])

// im onFrame:
const size = frame.allocationSize({ format: 'BGRA' });
const buf = new ArrayBuffer(size);
await frame.copyTo(new Uint8Array(buf), { format: 'BGRA' });
framePort?.postMessage(
  { type: 'video', buffer: buf, w: frame.displayWidth, h: frame.displayHeight, fpsN: 30 },
  [buf], // Transfer (zero-copy Ownership-Move)
);
```

> Den `'jmndi:frame-port'`-Empfang im **preload** verdrahten
> (`ipcRenderer.on('jmndi:frame-port', (e, data) => …)` liefert `e.ports`), da der
> Renderer keinen direkten ipc-Zugriff hat. Empfohlen: einen kleinen Buffer-Pool
> (z. B. 2–3 Buffer) nutzen, die der utilityProcess nach dem Senden zurückpostet,
> um GC-Druck bei 1080p zu vermeiden. Bei Rückstau **Frames droppen** (nur den
> neuesten behalten) — NDI ist live.

---

## 6. Audio (Phase 3)

- In `capture-handler.ts` ist `audio:'loopback'` für Windows bereits vorgesehen.
  In `capture.ts` `getDisplayMedia({ video: true, audio: true })` setzen (statt
  `audio:false`) und den **Audio-Track** ebenfalls über einen
  `MediaStreamTrackProcessor` lesen → `AudioData`.
- Pro `AudioData`: je Kanal `copyTo(plane, { planeIndex, format: 'f32-planar' })`
  in einen planar zusammengesetzten `Float32Array`, dann
  `{ type:'audio', buffer, ch, n: numberOfFrames, sr: sampleRate }` an den Port.
- A/V-Sync: zunächst `timecode_synthesize` (im Skelett schon gesetzt). Nur bei
  hörbarem Drift auf aus WebCodecs-Timestamps abgeleitete Timecodes umstellen.

---

## 7. Packaging (Windows)

### `tools/bundle-ndi.mjs` (Muster: `apps/media-converter/tools/bundle-ffmpeg.mjs`)
Kopiert beim `prepackage`:
- die gebaute `@jm/ndi`-`.node` (falls nicht aus node_modules auflösbar) und
- `%NDI_SDK_DIR%\Bin\x64\Processing.NDI.Lib.x64.dll`
nach `resources/bin/win/`. DLL + `.node` sind **gitignored** und werden pro Build
frisch bereitgestellt.

### `electron-builder.yml` ergänzen
```yaml
asarUnpack:
  - "**/node_modules/@jm/ndi/**"        # native .node kann nicht aus asar laden
# extraResources (resources → .) ist bereits gesetzt → liefert bin/win/*.dll mit
```

### `apps/ndi-screen-capture/package.json` `dist` anpassen
```json
"prepackage": "node tools/bundle-ndi.mjs",
"dist": "electron-vite build && npm run prepackage && electron-builder",
"dist:win": "electron-vite build && npm run prepackage && electron-builder --win"
```

### Runtime-DLL finden
`src/main/ndi/locate.ts` (Klon von `media-converter/src/main/ffmpeg/locate.ts`):
gepackt `process.resourcesPath/bin/win/Processing.NDI.Lib.x64.dll`, im Dev
`resources/bin/win/...`. Sicherstellen, dass diese DLL geladen wird (neben der
`.node` ablegen oder **dynamisch** via `NDIlib_v5_load`) — **nicht** in den
System-PATH installieren (NDI-Vorgabe).

---

## 8. Verifikation

1. `npm run ndi:dev` (oder gepackte EXE) → Quelle wählen → Start.
2. **NDI Studio Monitor** öffnen → Quelle `JM Capture (<host>) - <quelle>` muss
   erscheinen, Bild korrekt (BGRA-Farben, keine Verschiebung), Audio hörbar.
3. Gegencheck in **TriCaster / vMix / OBS** (NDI-Eingang).
4. `connections()` muss > 0 zeigen, sobald ein Empfänger zuhört.
5. Stabilität: 1080p30 ohne VideoFrame-Leak (Frame-Anzahl stabil), A/V-Sync ok.

---

## 9. Lizenz/Trademark-Checkliste (vor Release, Pflicht)

- [ ] NDI-SDK-Lizenz akzeptiert (Build-PC).
- [x] Trademark-Hinweis „NDI® is a registered trademark of Vizrt NDI AB" — steht
      bereits im App-Footer (`App.tsx`).
- [ ] NDI-Lizenztext der App beilegen.
- [ ] Nur die Runtime-DLL bündeln, im App-Ordner (nicht System-PATH), aktuell halten.
- [ ] Produktname „JM NDI Screen Capture" gegen die NDI Brand Guidelines prüfen
      (Verwendung von „NDI" im Produktnamen ggf. mit dem NDI-Team klären).

---

## 10. Risiken / Stolpersteine

- **ABI:** Addon muss gegen Electron 33 gerebuildet werden (`electron-rebuild`),
  sonst „NODE_MODULE_VERSION mismatch".
- **DLL nicht gefunden:** „NDIlib_initialize fehlgeschlagen" → DLL neben `.node`
  legen oder dynamisch laden; sicherstellen, dass `asarUnpack` greift.
- **Performance 1080p60:** utilityProcess + transferable Buffers + Frame-Drop +
  FPS-Cap. Bei Bedarf UYVY (halbe Bytes) statt BGRA als Perf-Option (`FourCC` +
  `copyTo` anpassen).
- **VideoFrame-Leak:** `frame.close()` ist bereits in `capture.ts` Pflicht — beim
  Erweitern beibehalten (auch im Fehlerpfad).
- **Audio-Loopback:** nur Windows; auf Mac später anderer Weg
  (`electron-audio-loopback` o. Ä.).

---

### Referenzdateien im Repo (Muster)
- ABI-Rebuild nativer Module: `apps/studio-control/package.json` (better-sqlite3)
- Binary-Bundling beim Packaging: `apps/media-converter/tools/bundle-ffmpeg.mjs`
- Runtime-Pfad-Auflösung: `apps/media-converter/src/main/ffmpeg/locate.ts`
- electron-builder native-unpack: `apps/studio-control/electron-builder.yml`
