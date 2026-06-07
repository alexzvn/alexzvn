import { MessageChannelMain, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron';
import { join } from 'node:path';

declare const __dirname: string;

let child: UtilityProcess | null = null;

/**
 * Startet den utilityProcess mit dem nativen NDI-Sender und verbindet ihn per
 * MessageChannelMain mit dem Renderer: ein Port-Ende geht an den Utility-Prozess
 * (empfängt Frames + sendet via @jm/ndi), das andere an den Renderer (postet die
 * BGRA-/FLTP-Buffer transferable). `name` ist der sichtbare NDI-Quellname.
 */
export function startSender(win: BrowserWindow, name: string): void {
  stopSender();
  child = utilityProcess.fork(join(__dirname, 'ndi-sender.cjs'));

  const { port1, port2 } = new MessageChannelMain();
  // Utility-Prozess: init + createSender(name); danach Frames über port2.
  child.postMessage({ type: 'init', name }, [port2]);
  // Renderer bekommt port1 und postet die Frames (Bridge im Preload → window).
  win.webContents.postMessage('jmndi:frame-port', null, [port1]);
}

export function stopSender(): void {
  if (child) {
    child.kill();
    child = null;
  }
}
