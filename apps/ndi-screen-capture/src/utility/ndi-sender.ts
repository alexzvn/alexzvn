// utilityProcess-Entry: hält das native @jm/ndi-Addon und sendet die vom
// Renderer übertragenen Frames als NDI-Quelle. Läuft isoliert vom Main-/UI-Pfad.
//
// Alle Nachrichten kommen über parentPort (der Main bridgt den Renderer-Frame-
// Port hierher weiter):
//   { type: 'init',  name }                                  → init + createSender
//   { type: 'video', buffer(ArrayBuffer, BGRA), w, h, fpsN } → send_video_v2
//   { type: 'audio', buffer(ArrayBuffer, FLTP), ch, n, sr }  → send_audio_v3
//   { type: 'stop' }                                         → destroy
import * as ndi from '@jm/ndi';

type Msg =
  | { type: 'init'; name: string }
  | { type: 'video'; buffer: ArrayBuffer; w: number; h: number; fpsN: number }
  | { type: 'audio'; buffer: ArrayBuffer; ch: number; n: number; sr: number }
  | { type: 'stop' };

let started = false;
let videoFrames = 0;

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;

  if (d.type === 'init') {
    try {
      ndi.init();
      ndi.createSender(d.name);
      started = true;
      console.log('[ndi-sender] NDI-Sender aktiv:', d.name);
    } catch (err) {
      started = false;
      console.error('[ndi-sender] init/createSender fehlgeschlagen:', err);
    }
    return;
  }

  if (!started) return;

  if (d.type === 'video') {
    ndi.sendVideoBGRA(new Uint8Array(d.buffer), d.w, d.h, d.fpsN, 1);
    // Heartbeat ~alle 10 s: bestätigt Versand + zeigt verbundene Empfänger.
    if (videoFrames++ % 300 === 0) {
      console.log(`[ndi-sender] aktiv: ${d.w}x${d.h}, Empfänger: ${ndi.connections()}`);
    }
  } else if (d.type === 'audio') {
    ndi.sendAudioFLTP(new Float32Array(d.buffer), d.ch, d.n, d.sr);
  } else if (d.type === 'stop') {
    ndi.destroy();
    started = false;
    console.log('[ndi-sender] gestoppt');
  }
});
