import { MessageChannelMain, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron';
import { join } from 'node:path';

declare const __dirname: string;

let child: UtilityProcess | null = null;

/**
 * Startet den utilityProcess mit dem nativen NDI-Sender.
 *
 * Frame-Weg: Der Renderer bekommt `port1` und postet BGRA-/FLTP-Buffer darauf;
 * `port2` bleibt im Main und leitet jede Nachricht per `child.postMessage` (mit
 * Buffer-Transfer) an den Utility-Prozess weiter, der sie über `parentPort`
 * empfängt. (Ein direktes Renderer↔Utility-MessagePort liefert in dieser
 * Electron-Version nicht zuverlässig — deshalb bridgen wir über den Main; die
 * Pixel werden hier nur durchgereicht, nicht verarbeitet.) `name` ist der
 * sichtbare NDI-Quellname.
 */
export function startSender(win: BrowserWindow, name: string): void {
  stopSender();
  child = utilityProcess.fork(join(__dirname, 'ndi-sender.cjs'));

  // init (Sendername) → Utility erstellt NDI-Sender.
  child.postMessage({ type: 'init', name });

  // Frame-Kanal: port1 an den Renderer, port2 im Main als Weiterleitung.
  const { port1, port2 } = new MessageChannelMain();
  let forwarded = 0;
  port2.on('message', (e) => {
    const data = e.data as { type: string; buffer?: ArrayBuffer };
    if (forwarded % 30 === 0) {
      console.log(`[main-bridge] Frame vom Renderer #${forwarded} (type=${data?.type}) → Utility`);
    }
    forwarded++;
    if (data?.buffer) {
      child?.postMessage(data, [data.buffer]); // Buffer transferable weiterreichen
    } else {
      child?.postMessage(data);
    }
  });
  port2.start();

  win.webContents.postMessage('jmndi:frame-port', null, [port1]);
}

export function stopSender(): void {
  if (child) {
    child.kill();
    child = null;
  }
}
