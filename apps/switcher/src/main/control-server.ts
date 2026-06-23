// TCP-Steuerserver (Slice 6): Fernsteuerung des Switchers über das geteilte
// Zeilenprotokoll @jm/companion-protocol — getrieben z. B. vom Bitfocus-Companion-
// Modul (packages/companion-jm-switcher).
//
//   Client → Switcher: PREVIEW/PROGRAM/CUT/AUTO/RECORD/STREAM/STATE?
//   Switcher → Client: STATE … (auf Verbindung, bei jeder Zustandsänderung)
//
// Der eigentliche Zustand lebt im Renderer (Engine/Output). Befehle werden per
// IPC dorthin geschickt; der Renderer meldet seinen Zustand via pushState()
// zurück, den wir cachen + an alle Clients broadcasten.
import net from 'node:net';
import type { BrowserWindow } from 'electron';
import { advertise, type Advertiser } from '@jm/discovery';
import {
  createLineBuffer,
  formatState,
  parseCommand,
  type ControlCommand,
  type SwitcherStateMsg,
} from '@jm/companion-protocol';

let server: net.Server | null = null;
const clients = new Set<net.Socket>();
let targetWindow: BrowserWindow | null = null;
let lastState: SwitcherStateMsg = {
  program: 0,
  preview: 0,
  recording: false,
  streaming: false,
  scenes: 0,
};
let running = false;
let boundPort = 0;
// mDNS-Annoncierung an den Steuerserver gekoppelt: nur wenn er lauscht, ist der
// Switcher im LAN auffindbar (Stage Display verbindet ohne IP-Eingabe). Best-effort.
let advertiser: Advertiser | null = null;

export interface ControlStatus {
  running: boolean;
  port: number;
  clients: number;
}

export function attachControlWindow(win: BrowserWindow): void {
  targetWindow = win;
}

export function controlStatus(): ControlStatus {
  return { running, port: boundPort, clients: clients.size };
}

// Beim Beenden räumt stopControlServer() auf, während das Fenster schon zerstört
// ist (Socket-close/notifyStatus feuern dann noch). `?.` schützt nur gegen null,
// nicht gegen ein zerstörtes webContents → sonst „Object has been destroyed".
function send(channel: string, payload: unknown): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  if (!wc.isDestroyed()) wc.send(channel, payload);
}

function notifyStatus(): void {
  send('control:status', controlStatus());
}

export function startControlServer(port: number): Promise<{ ok: boolean; error?: string; port?: number }> {
  return new Promise((resolve) => {
    stopControlServer();
    const srv = net.createServer((socket) => {
      clients.add(socket);
      socket.setEncoding('utf8');
      socket.write(formatState(lastState)); // Begrüßung mit aktuellem Zustand
      const feed = createLineBuffer((line) => {
        const cmd = parseCommand(line);
        if (cmd) handleCommand(cmd, socket);
      });
      socket.on('data', (d) => feed(String(d)));
      socket.on('error', () => {});
      socket.on('close', () => {
        clients.delete(socket);
        notifyStatus();
      });
      notifyStatus();
    });
    srv.on('error', (e) => {
      server = null;
      running = false;
      boundPort = 0;
      notifyStatus();
      resolve({ ok: false, error: e.message });
    });
    srv.listen(port, () => {
      server = srv;
      running = true;
      boundPort = port;
      try {
        advertiser = advertise({ appId: 'jm-switcher', role: 'switcher', port });
      } catch {
        /* mDNS optional */
      }
      notifyStatus();
      resolve({ ok: true, port });
    });
  });
}

function handleCommand(cmd: ControlCommand, socket: net.Socket): void {
  if (cmd.type === 'queryState') {
    socket.write(formatState(lastState));
    return;
  }
  send('control:command', cmd);
}

export function stopControlServer(): void {
  if (advertiser) {
    advertiser.stop();
    advertiser = null;
  }
  for (const c of clients) {
    try {
      c.destroy();
    } catch {
      // egal
    }
  }
  clients.clear();
  if (server) {
    server.close();
    server = null;
  }
  if (running) {
    running = false;
    boundPort = 0;
    notifyStatus();
  }
}

/** Renderer meldet neuen Zustand → cachen + an alle Clients broadcasten. */
export function pushState(state: SwitcherStateMsg): void {
  lastState = state;
  if (clients.size === 0) return;
  const line = formatState(state);
  for (const c of clients) {
    try {
      c.write(line);
    } catch {
      // egal
    }
  }
}
