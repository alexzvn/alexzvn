// utilityProcess-Entry: hält das native @jm/ndi-Addon und sendet die vom
// Renderer übertragenen Frames als NDI-Quelle. Läuft isoliert vom Main-/UI-Pfad,
// damit das (bei 1080p schwere) Senden die Oberfläche nicht blockiert.
//
// Protokoll:
//   parentPort 1x: { type: 'init', name }  + [Frame-Port]  → init + createSender
//   Frame-Port:    { type: 'video', buffer(ArrayBuffer, BGRA), w, h, fpsN }
//                  { type: 'audio', buffer(ArrayBuffer, FLTP), ch, n, sr }
//                  { type: 'stop' }
import type { MessagePortMain } from 'electron';
import * as ndi from '@jm/ndi';

type FrameMsg =
  | { type: 'video'; buffer: ArrayBuffer; w: number; h: number; fpsN: number }
  | { type: 'audio'; buffer: ArrayBuffer; ch: number; n: number; sr: number }
  | { type: 'stop' };

let started = false;

process.parentPort.on('message', (e) => {
  const port: MessagePortMain | undefined = e.ports[0];
  const init = e.data as { type?: string; name?: string } | undefined;
  if (!port) return;

  if (init?.type === 'init' && init.name) {
    try {
      ndi.init();
      ndi.createSender(init.name);
      started = true;
    } catch {
      // Addon nicht gebaut / NDI-Runtime fehlt → still bleiben (kein Crash).
      started = false;
    }
  }

  port.on('message', (msg) => {
    if (!started) return;
    const d = msg.data as FrameMsg;
    if (d.type === 'video') {
      ndi.sendVideoBGRA(new Uint8Array(d.buffer), d.w, d.h, d.fpsN, 1);
    } else if (d.type === 'audio') {
      ndi.sendAudioFLTP(new Float32Array(d.buffer), d.ch, d.n, d.sr);
    } else if (d.type === 'stop') {
      ndi.destroy();
      started = false;
    }
  });
  port.start();
});
