// utilityProcess-Entry: hält das native @jm/ndi-Addon und EMPFÄNGT eine
// NDI-Quelle. Läuft isoliert vom Main-/UI-Pfad, weil receive() synchron pollt
// (blockierender Aufruf) — das darf den Main-Thread nicht anhalten.
//
// Nachrichten (über parentPort; der Main bridgt sie vom Renderer hierher):
//   { type: 'find', timeoutMs }   → findSources → { type:'sources', list }
//   { type: 'connect', source }   → createReceiver + Poll-Schleife starten
//   { type: 'disconnect' }        → closeReceiver + Schleife stoppen
//   { type: 'ack' }               → Renderer hat das letzte Videoframe verarbeitet
//
// An den Main zurück:
//   { type: 'status', state, message? }
//   { type: 'sources', list, error? }
//   { type: 'video', data(BGRA), width, height, lineStride, fpsN, fpsD }
//
// Backpressure: nach jedem gesendeten Videoframe wird `awaitingAck` gesetzt;
// bis der Renderer per 'ack' bestätigt, werden weitere Videoframes nur aus dem
// NDI-Puffer GEZOGEN und verworfen (nie gequeued) — so bleibt die Latenz niedrig
// und der Speicher bei langsamen Renderern beschränkt. Audio wird (noch) nur
// gedraint, nicht weitergeleitet (kein Audio-Mix im Switcher in dieser Slice).
import * as ndi from '@jm/ndi';
import type { NdiFrame } from '@jm/ndi';

type Msg =
  | { type: 'find'; timeoutMs?: number }
  | { type: 'connect'; source: string }
  | { type: 'disconnect' }
  | { type: 'ack' };

let connected = false;
let polling = false;
let stopRequested = false;
let awaitingAck = false;

function postStatus(state: string, message?: string): void {
  process.parentPort.postMessage({ type: 'status', state, message });
}

function safeReceive(timeoutMs: number): NdiFrame | null {
  try {
    return ndi.receive(timeoutMs);
  } catch {
    return null;
  }
}

process.parentPort.on('message', (e) => {
  const d = e.data as Msg | null;
  if (!d || typeof d !== 'object') return;
  switch (d.type) {
    case 'find':
      handleFind(d.timeoutMs ?? 1500);
      break;
    case 'connect':
      handleConnect(d.source);
      break;
    case 'disconnect':
      handleDisconnect();
      break;
    case 'ack':
      awaitingAck = false;
      break;
  }
});

function handleFind(timeoutMs: number): void {
  try {
    ndi.init();
    // NDI-Discovery ist asynchron. Der persistente Finder (g_find im Addon)
    // akkumuliert Quellen über die Zeit; wir geben ihm in mehreren kurzen
    // Wait-Runden Zeit, ALLE Geräte zu finden, und vereinen die Ergebnisse —
    // sonst sieht ein einzelner Aufruf nur einen Teil (Issue #17).
    const seen = new Set<string>();
    const rounds = Math.max(2, Math.ceil(timeoutMs / 500));
    for (let i = 0; i < rounds; i++) {
      for (const s of ndi.findSources(500)) seen.add(s);
    }
    process.parentPort.postMessage({ type: 'sources', list: [...seen] });
  } catch (err) {
    process.parentPort.postMessage({
      type: 'sources',
      list: [],
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function handleConnect(source: string): void {
  handleDisconnect();
  stopRequested = false;
  postStatus('connecting', source);
  try {
    ndi.init();
    const ok = ndi.createReceiver(source);
    if (!ok) {
      postStatus('error', `createReceiver('${source}') fehlgeschlagen`);
      return;
    }
    connected = true;
    awaitingAck = false;
    postStatus('connected', source);
    pump();
  } catch (err) {
    connected = false;
    postStatus('error', err instanceof Error ? err.message : String(err));
  }
}

function handleDisconnect(): void {
  stopRequested = true;
  if (!connected) return;
  connected = false;
  try {
    ndi.closeReceiver();
  } catch {
    // egal — Receiver war evtl. nie offen
  }
  postStatus('disconnected');
}

function pump(): void {
  if (polling) return;
  polling = true;

  const tick = (): void => {
    if (stopRequested || !connected) {
      polling = false;
      return;
    }
    // Pro Tick einige Frames aus dem NDI-Puffer ziehen, dann den Event-Loop
    // freigeben, damit 'ack'/'disconnect' verarbeitet werden.
    for (let i = 0; i < 4; i++) {
      const frame = safeReceive(60);
      if (!frame) break;
      if (frame.type === 'video') {
        if (awaitingAck) continue; // Renderer noch beschäftigt → Frame verwerfen
        awaitingAck = true;
        process.parentPort.postMessage({
          type: 'video',
          data: frame.data, // Uint8Array/Buffer — Kopie via structured clone, KEIN Transfer
          width: frame.width,
          height: frame.height,
          lineStride: frame.lineStride,
          fpsN: frame.fpsN,
          fpsD: frame.fpsD,
        });
      }
      // Audio-Frames werden gedraint, aber (noch) nicht weitergeleitet.
    }
    setTimeout(tick, 0);
  };

  tick();
}
