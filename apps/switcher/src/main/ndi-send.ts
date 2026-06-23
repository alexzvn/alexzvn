// NDI-Ausgabe-Bridge im Main: startet den utilityProcess mit dem nativen
// NDI-Sender und reicht den Frame-Kanal an den Renderer durch. Der Renderer
// postet BGRA-Frames (Program- oder Multiview-Bild) auf port1; port2 bleibt im
// Main und leitet jede Nachricht an den Utility-Prozess weiter (ein direktes
// Renderer↔Utility-MessagePort liefert in dieser Electron-Version nicht
// zuverlässig — siehe @jm/titler). Identische Mechanik wie der NDI-Empfang
// (ndi-receive.ts), nur in Senderichtung und mit genau EINEM Sender.
import { MessageChannelMain, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron';
import { join } from 'node:path';

declare const __dirname: string;

let child: UtilityProcess | null = null;
let targetWindow: BrowserWindow | null = null;
let sourceName = '';
let connections = 0;

export function attachNdiSendWindow(win: BrowserWindow): void {
  targetWindow = win;
}

function utilityPath(): string {
  return join(__dirname, 'ndi-send.cjs');
}

function emitStatus(): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  if (!wc.isDestroyed()) {
    wc.send('output:ndi-status', { active: child != null, name: sourceName, connections });
  }
}

/** NDI-Ausgabe mit sichtbarem Quellnamen starten. Idempotent (Neustart). */
export function startNdiOutput(name: string): { ok: boolean; error?: string } {
  if (!targetWindow) return { ok: false, error: 'Kein Fenster' };
  stopNdiOutput();
  sourceName = name;
  connections = 0;
  try {
    child = utilityProcess.fork(utilityPath());
  } catch (e) {
    child = null;
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  child.on('message', (msg: unknown) => {
    const m = msg as { type?: string; connections?: number } | null;
    if (m && m.type === 'stat' && typeof m.connections === 'number') {
      connections = m.connections;
      emitStatus();
    }
  });
  child.on('exit', () => {
    if (child) {
      child = null;
      connections = 0;
      emitStatus();
    }
  });

  child.postMessage({ type: 'init', name });

  // Frame-Kanal: port1 an den Renderer, port2 im Main als Weiterleitung.
  const { port1, port2 } = new MessageChannelMain();
  port2.on('message', (e) => child?.postMessage(e.data));
  port2.start();
  targetWindow.webContents.postMessage('jmswitch:ndi-out-port', null, [port1]);

  emitStatus();
  return { ok: true };
}

export function stopNdiOutput(): void {
  if (child) {
    try {
      child.postMessage({ type: 'stop' });
    } catch {
      // schon tot
    }
    try {
      child.kill();
    } catch {
      // egal
    }
    child = null;
  }
  connections = 0;
  emitStatus();
}

export function ndiOutputStatus(): { active: boolean; name: string; connections: number } {
  return { active: child != null, name: sourceName, connections };
}
