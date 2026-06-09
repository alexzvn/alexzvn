// NDI-Empfangs-Bridge im Main:
//   utilityProcess (ndi-recv.cjs)  ⇄  Main  ⇄  Renderer
//
// Steuerung läuft über IPC (find/connect/disconnect/status). Frames laufen über
// einen MessageChannelMain: `port1` geht an den Renderer, `port2` bleibt hier.
//   - Videoframes: Utility → Main (child 'message') → port2.postMessage → Renderer.
//   - Ack:         Renderer → port2 ('message') → child.postMessage.
// Buffer werden bei jedem Hop KOPIERT (kein Transfer) — sonst kämen ArrayBuffer
// über die Port-/Prozessgrenzen als null an (Lehre aus der NDI Screen Capture).
import { MessageChannelMain, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import type { NdiStatus } from '@shared/types';

declare const __dirname: string;

let child: UtilityProcess | null = null;
let port2: Electron.MessagePortMain | null = null;
let targetWindow: BrowserWindow | null = null;
let status: NdiStatus = { state: 'idle', source: null };
let pendingFinds: ((list: string[]) => void)[] = [];

/** Einmalig beim Fenster-Erzeugen aufrufen. */
export function attachNdiWindow(win: BrowserWindow): void {
  targetWindow = win;
}

function mapState(state: string): NdiStatus['state'] {
  switch (state) {
    case 'connecting':
    case 'connected':
    case 'disconnected':
    case 'error':
      return state;
    default:
      return 'idle';
  }
}

function onChildMessage(msg: unknown): void {
  const m = msg as { type?: string; [k: string]: unknown } | null;
  if (!m || typeof m !== 'object') return;

  if (m.type === 'video') {
    // Unverändert an den Renderer weiterreichen (Kopie, kein Transfer).
    port2?.postMessage(m);
    return;
  }
  if (m.type === 'status') {
    status = { state: mapState(String(m.state)), source: (m.message as string) ?? null };
    targetWindow?.webContents.send('ndi:status', status);
    return;
  }
  if (m.type === 'sources') {
    const cbs = pendingFinds;
    pendingFinds = [];
    const list = Array.isArray(m.list) ? (m.list as string[]) : [];
    for (const cb of cbs) cb(list);
    return;
  }
}

function ensureChild(): UtilityProcess | null {
  if (child) return child;
  if (!targetWindow) return null;

  child = utilityProcess.fork(join(__dirname, 'ndi-recv.cjs'));
  child.on('message', onChildMessage);
  child.on('exit', () => {
    child = null;
    port2 = null;
    if (status.state !== 'idle') {
      status = { state: 'idle', source: null };
      targetWindow?.webContents.send('ndi:status', status);
    }
  });

  // Frame-Kanal: port1 an den Renderer, port2 hier zum Bridgen.
  const { port1, port2: p2 } = new MessageChannelMain();
  port2 = p2;
  port2.on('message', (e) => {
    // Renderer → Utility (z. B. Ack). Kopie, kein Transfer.
    child?.postMessage(e.data);
  });
  port2.start();
  targetWindow.webContents.postMessage('jmswitch:ndi-port', null, [port1]);

  return child;
}

export function ndiFind(timeoutMs = 1500): Promise<string[]> {
  const c = ensureChild();
  if (!c) return Promise.resolve([]);
  return new Promise((resolve) => {
    pendingFinds.push(resolve);
    c.postMessage({ type: 'find', timeoutMs });
    // Sicherheitsnetz, falls der Utility nicht antwortet.
    setTimeout(() => {
      const i = pendingFinds.indexOf(resolve);
      if (i >= 0) {
        pendingFinds.splice(i, 1);
        resolve([]);
      }
    }, timeoutMs + 4000);
  });
}

export function ndiConnect(source: string): void {
  ensureChild()?.postMessage({ type: 'connect', source });
}

export function ndiDisconnect(): void {
  child?.postMessage({ type: 'disconnect' });
}

export function ndiStatus(): NdiStatus {
  return status;
}

/** Beim Beenden/Fenster-Schließen aufrufen. */
export function stopNdi(): void {
  if (child) {
    child.kill();
    child = null;
  }
  port2 = null;
  status = { state: 'idle', source: null };
}
