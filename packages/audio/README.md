# @jm/audio

Native **Audio-Capture**-Bindings über **PortAudio** mit **ASIO-Host** (Windows)
— für Mehrkanal-Aufnahme von der **Dante Virtual Soundcard (DVSC)** und anderen
ASIO/WASAPI-Geräten. Liefert Float32-**planar** (FLTP-Layout `[ch0][ch1]…`,
identisch zur NDI-Audio-Konvention der Suite). Muster wie `packages/ndi`
(Muster A — eigenes N-API-Addon, SDK bring-your-own, Runtime gebündelt).

> **Status: Spike-Scaffold.** Code ist vollständig und compile-fertig, aber noch
> **nicht** auf Hardware gebaut/getestet. Build + DVSC-Test sind der nächste
> Schritt auf einem Windows-Rechner (siehe unten). Das ist laut Roadmap der
> riskanteste Teil — bewusst zuerst.

## API (siehe `index.d.ts`)

```js
const audio = require('@jm/audio');
audio.init();
const devices = audio.listDevices();           // inkl. hostApiName ("ASIO") + maxInputChannels
audio.openInput({ device, channels: 16, sampleRate: 48000 }, (planar, ch, frames) => {
  // planar: Float32Array [ch0:frames][ch1:frames]… (Kopie, sofort verarbeiten)
});
// …
audio.stopInput();
audio.terminate();
```

Genau **ein** aktiver Eingangsstream gleichzeitig (MVP). Die Callback läuft auf
dem Node-Loop (per ThreadSafeFunction vom Audio-Thread gemarshalt); der Block
ist eine **Kopie** und nach Rückkehr ungültig.

## Build (Windows, mit ASIO)

PortAudio + ASIO-SDK sind **nicht** eingecheckt (ASIO-SDK ist nicht
redistribuierbar). Einmalig bereitstellen:

1. **Steinberg ASIO-SDK** herunterladen (Steinberg-Entwicklerseite), z. B. nach
   `C:\sdk\asiosdk`.
2. **PortAudio** mit ASIO bauen (CMake), ASIO-SDK-Pfad übergeben:
   ```powershell
   git clone https://github.com/PortAudio/portaudio
   cd portaudio
   cmake -B build -A x64 -DPA_USE_ASIO=ON -DASIOSDK_ROOT_DIR="C:\sdk\asiosdk"
   cmake --build build --config Release
   ```
   Ergebnis: `build\Release\portaudio_x64.lib` (+ `portaudio_x64.dll`) und die
   Header in `include\`. Diese beiden in einen Ordner legen, z. B.:
   ```
   C:\sdk\portaudio\include\portaudio.h
   C:\sdk\portaudio\lib\portaudio_x64.lib
   ```
3. **Env setzen + Addon bauen** (System-Node oder Electron):
   ```powershell
   setx PORTAUDIO_DIR "C:\sdk\portaudio"
   # neue Shell, dann:
   npm run rebuild -w @jm/audio
   # für Electron-Hauptprozess/utilityProcess:
   npx electron-rebuild --only @jm/audio
   ```
   `npm install` baut **nicht** automatisch, wenn `PORTAUDIO_DIR` fehlt
   (Guard in `scripts/maybe-build.mjs`) — Codespace/CI bleiben grün.

## Spike-Test gegen DVSC

```powershell
# DVSC starten, in Dante Controller ein paar Kanäle routen, Signal anlegen.
node test/spike.cjs                 # Geräte listen → DVSC-Index + "ASIO" finden
node test/spike.cjs 3 16 48000      # Gerät 3, 16 Kanäle @ 48 kHz, 5 s Pegelmessung
```
**Erfolg (Exit-Kriterium Phase 1):** DVSC erscheint unter Host-API „ASIO",
mehrkanaliges Öffnen klappt, belegte Kanäle zeigen Pegel > -inf, Kanal-Mapping
und Samplerate stimmen.

## Bekannte Risiken / offene Punkte

- **PortAudio-Build mit ASIO** ist die eigentliche Hürde (CMake + ASIO-SDK-Pfad).
  Pragmatischer Fallback, falls der Eigenbau zäh wird: `naudiodon2` (npm) wrappt
  PortAudio inkl. ASIO — dann dieses Addon durch dünnen Adapter ersetzen.
- **ASIO-Kanal-Selektion:** aktuell Default-Mapping (erste *n* Kanäle). Gezielte
  Kanalauswahl braucht `paAsioStreamInfo`/`PaAsio_*` (pa_asio.h) — v0.2.
- **ASIO = exklusiv:** nur eine App hält das Gerät. Dante Controller darf parallel
  laufen, andere ASIO-Consumer nicht.
- **Backpressure:** `NonBlockingCall` verwirft Blöcke bei voller Queue
  (= Aufnahmelücke). Für die Recorder-Disk-Aufnahme ggf. Ringpuffer/Blocking
  prüfen — v0.2.
- **Gepackte App:** falls PortAudio dynamisch gelinkt, `portaudio_x64.dll` neben
  `jm_audio.node` nach `resources/bin/win` bündeln (Bundle-Script analog
  `packages/ndi/tools/bundle-ndi.mjs` ergänzen). Statischer Link spart das.

Genutzt von: **JM Audio Recorder** (Phase 3). Siehe Roadmap
[[jm-suite-next-tools-roadmap]].
