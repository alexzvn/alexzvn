import { MessageChannelMain, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron';
import { join } from 'node:path';

declare const __dirname: string;

let child: UtilityProcess | null = null;

/**
 * Startet den utilityProcess mit dem nativen NDI-Sender.
 *
 * Frame-Weg: Der Renderer bekommt `port1` und postet BGRA-Buffer darauf; `port2`
 * bleibt im Main und leitet jede Nachricht per `child.postMessage` an den
 * Utility-Prozess weiter (der sie über `parentPort` empfängt). Ein direktes
 * Renderer↔Utility-MessagePort liefert in dieser Electron-Version nicht
 * zuverlässig — deshalb bridgen wir über den Main. `name` ist der sichtbare
 * NDI-Quellname.
 */
export function startSender(
  win: BrowserWindow,
  name: string,
  onStat?: (connections: number) => void,
): void {
  stopSender();
  child = utilityProcess.fork(join(__dirname, 'ndi-sender.cjs'));

  child.on('message', (msg: unknown) => {
    const m = msg as { type?: string; connections?: number } | null;
    if (m && m.type === 'stat' && typeof m.connections === 'number') {
      onStat?.(m.connections);
    }
  });

  child.postMessage({ type: 'init', name });

  // Frame-Kanal: port1 an den Renderer, port2 im Main als Weiterleitung.
  const { port1, port2 } = new MessageChannelMain();
  port2.on('message', (e) => {
    // Ohne Transfer weiterreichen — der Buffer wird kopiert. (Ein transferierter
    // ArrayBuffer käme über die Port-Grenzen als null an.)
    child?.postMessage(e.data);
  });
  port2.start();

  win.webContents.postMessage('jmtitler:frame-port', null, [port1]);
}

export function stopSender(): void {
  if (child) {
    try {
      child.postMessage({ type: 'stop' });
    } catch {
      // schon tot
    }
    child.kill();
    child = null;
  }
}

export function senderActive(): boolean {
  return child != null;
}
