import net from 'node:net';
import { createLineBuffer, parseState } from '@jm/companion-protocol';
import type { SwitcherSource } from '@shared/types';

export const SWITCHER_OFFLINE: SwitcherSource = {
  connected: false,
  program: 0,
  preview: 0,
  recording: false,
  streaming: false,
  scenes: 0,
};

const RECONNECT_MS = 2000;

/** TCP-Client auf den Switcher-Steuerserver (Companion-Zeilenprotokoll). */
export class SwitcherClient {
  private socket: net.Socket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private host = '';
  private port = 0;
  private readonly onChange: (s: SwitcherSource) => void;

  constructor(onChange: (s: SwitcherSource) => void) {
    this.onChange = onChange;
  }

  connect(host: string, port: number): void {
    this.disconnect();
    this.active = true;
    this.host = host;
    this.port = port;
    this.open();
  }

  private open(): void {
    if (!this.active) return;
    const socket = net.connect({ host: this.host, port: this.port });
    socket.setEncoding('utf8');
    const feed = createLineBuffer((line) => {
      const st = parseState(line);
      if (st) {
        this.onChange({
          connected: true,
          program: st.program,
          preview: st.preview,
          recording: st.recording,
          streaming: st.streaming,
          scenes: st.scenes,
        });
      }
    });
    socket.on('connect', () => socket.write('STATE?\n'));
    socket.on('data', (chunk: string) => feed(chunk));
    socket.on('error', () => {
      /* 'close' folgt → Reconnect dort */
    });
    socket.on('close', () => {
      this.onChange({ ...SWITCHER_OFFLINE });
      this.scheduleReconnect();
    });
    this.socket = socket;
  }

  private scheduleReconnect(): void {
    if (!this.active) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), RECONNECT_MS);
  }

  disconnect(): void {
    this.active = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.onChange({ ...SWITCHER_OFFLINE });
  }
}
