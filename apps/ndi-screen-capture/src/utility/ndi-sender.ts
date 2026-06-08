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
let videoFrames = 0;

// Sichtbar machen, dass der Utility-Prozess hochkam und @jm/ndi geladen wurde.
// (Wenn der Import oben wirft, stirbt der Prozess hier vorher → im Terminal sichtbar.)
console.log('[ndi-sender] gestartet; @jm/ndi geladen:', typeof ndi.init === 'function');

process.parentPort.on('message', (e) => {
  const port: MessagePortMain | undefined = e.ports[0];
  const init = e.data as { type?: string; name?: string } | undefined;
  console.log('[ndi-sender] Nachricht:', init?.type, '| Port vorhanden:', !!port);
  if (!port) return;

  if (init?.type === 'init' && init.name) {
    try {
      ndi.init();
      ndi.createSender(init.name);
      started = true;
      console.log('[ndi-sender] NDI-Sender erstellt:', init.name);
    } catch (err) {
      started = false;
      console.error('[ndi-sender] init/createSender FEHLGESCHLAGEN:', err);
    }
  }

  port.on('message', (msg) => {
    const d = msg.data as FrameMsg | null;
    if (!d || typeof d !== 'object') {
      // Leere/Null-Nachricht (z. B. Steuer-/Schließ-Event) → ignorieren statt crashen.
      return;
    }
    if (!started) return;
    if (d.type === 'video') {
      ndi.sendVideoBGRA(new Uint8Array(d.buffer), d.w, d.h, d.fpsN, 1);
      if (videoFrames++ % 30 === 0) {
        console.log(`[ndi-sender] video #${videoFrames} ${d.w}x${d.h} | Empfänger: ${ndi.connections()}`);
      }
    } else if (d.type === 'audio') {
      ndi.sendAudioFLTP(new Float32Array(d.buffer), d.ch, d.n, d.sr);
    } else if (d.type === 'stop') {
      ndi.destroy();
      started = false;
      console.log('[ndi-sender] gestoppt');
    }
  });
  port.start();
});
