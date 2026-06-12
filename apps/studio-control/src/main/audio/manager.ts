import net from 'node:net';
import dgram from 'node:dgram';
import { getAdapter, type ConsoleAdapter } from './adapters';
import { encodeOsc } from './osc';
import { getAudioConsoles } from '../config/audio';
import {
  oscMessageFor,
  type AudioAction,
  type AudioConnectionState,
  type AudioConsoleConfig,
  type AudioStatus,
} from '@shared/audio';

const RECONNECT_MS = 2500;

interface Connection {
  status(): AudioStatus;
  send(action: AudioAction): void;
  close(): void;
}

// TCP control (native protocol) — used for the `tcp` and `dante` transports.
class TcpConnection implements Connection {
  private socket: net.Socket | null = null;
  private state: AudioConnectionState = 'connecting';
  private lastError: string | undefined;
  private closed = false;
  private reconnectT: NodeJS.Timeout | null = null;

  constructor(
    private readonly cfg: AudioConsoleConfig,
    private readonly adapter: ConsoleAdapter,
    private readonly onStatus: (s: AudioStatus) => void,
  ) {
    this.connect();
  }

  private connect(): void {
    this.setState('connecting');
    const s = net.connect({ host: this.cfg.host, port: this.cfg.port });
    this.socket = s;
    s.setKeepAlive(true, 10_000);
    s.on('connect', () => this.setState('connected'));
    s.on('error', (e) => {
      this.lastError = describeNetError(e);
    });
    s.on('close', () => {
      if (this.closed) return;
      this.setState('down');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectT || this.closed) return;
    this.reconnectT = setTimeout(() => {
      this.reconnectT = null;
      if (!this.closed) this.connect();
    }, RECONNECT_MS);
  }

  private setState(state: AudioConnectionState): void {
    if (state === this.state) return;
    this.state = state;
    if (state === 'connected') this.lastError = undefined;
    this.onStatus(this.status());
  }

  status(): AudioStatus {
    return {
      id: this.cfg.id,
      state: this.state,
      transport: this.cfg.transport,
      lastChecked: Date.now(),
      lastError: this.lastError,
    };
  }

  send(action: AudioAction): void {
    if (!this.socket || this.state !== 'connected') throw new Error('not_connected');
    const buf = this.adapter.encodeTcp(action);
    if (buf) this.socket.write(buf);
  }

  close(): void {
    this.closed = true;
    if (this.reconnectT) {
      clearTimeout(this.reconnectT);
      this.reconnectT = null;
    }
    try {
      this.socket?.destroy();
    } catch {
      /* ignore */
    }
    this.socket = null;
  }
}

// OSC over UDP (bridge transport). UDP is connectionless → always "open".
class OscConnection implements Connection {
  private readonly socket = dgram.createSocket('udp4');
  private lastError: string | undefined;

  constructor(
    private readonly cfg: AudioConsoleConfig,
    private readonly onStatus: (s: AudioStatus) => void,
  ) {
    this.socket.on('error', (e) => {
      this.lastError = e.message;
      this.onStatus(this.status());
    });
  }

  status(): AudioStatus {
    return {
      id: this.cfg.id,
      state: 'connected',
      transport: this.cfg.transport,
      lastChecked: Date.now(),
      lastError: this.lastError,
    };
  }

  send(action: AudioAction): void {
    const buf = encodeOsc(oscMessageFor(this.cfg.type, action));
    this.socket.send(buf, this.cfg.port, this.cfg.host, () => {
      /* fire-and-forget */
    });
  }

  close(): void {
    try {
      this.socket.close();
    } catch {
      /* ignore */
    }
  }
}

interface Entry {
  cfg: AudioConsoleConfig;
  conn: Connection;
}

const entries = new Map<string, Entry>();
const listeners = new Set<(s: AudioStatus) => void>();

function emit(s: AudioStatus): void {
  for (const l of listeners) l(s);
}

export function onAudioStatusChange(cb: (s: AudioStatus) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAudioStatuses(): AudioStatus[] {
  return [...entries.values()].map((e) => e.conn.status());
}

function makeConnection(cfg: AudioConsoleConfig): Connection {
  if (cfg.transport === 'osc') {
    return new OscConnection(cfg, emit);
  }
  // tcp + dante both speak the native protocol over a TCP socket.
  return new TcpConnection(cfg, getAdapter(cfg.type), emit);
}

function sameEndpoint(a: AudioConsoleConfig, b: AudioConsoleConfig): boolean {
  return a.host === b.host && a.port === b.port && a.transport === b.transport && a.type === b.type;
}

export function syncAudioFromConfig(): void {
  const cfgs = getAudioConsoles();
  const seen = new Set<string>();
  for (const cfg of cfgs) {
    seen.add(cfg.id);
    const existing = entries.get(cfg.id);
    if (existing && sameEndpoint(existing.cfg, cfg)) {
      existing.cfg = cfg; // channel/name changes don't need a reconnect
      continue;
    }
    existing?.conn.close();
    const conn = makeConnection(cfg);
    entries.set(cfg.id, { cfg, conn });
    emit(conn.status());
  }
  for (const [id, e] of [...entries.entries()]) {
    if (!seen.has(id)) {
      e.conn.close();
      entries.delete(id);
    }
  }
}

/** Send a control action to a console. Returns false if unknown or not ready. */
export function sendAudio(id: string, action: AudioAction): boolean {
  const e = entries.get(id);
  if (!e) return false;
  try {
    e.conn.send(action);
    return true;
  } catch {
    return false;
  }
}

export function stopAudio(): void {
  for (const e of entries.values()) e.conn.close();
  entries.clear();
}

function describeNetError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'ECONNREFUSED':
      return 'Verbindung abgelehnt — Port/Remote-Control prüfen';
    case 'EHOSTUNREACH':
      return 'Host nicht erreichbar — Netzwerk/VLAN prüfen';
    case 'ETIMEDOUT':
      return 'Zeitüberschreitung';
    case 'ECONNRESET':
      return 'Verbindung zurückgesetzt';
    case 'ENOTFOUND':
      return 'Hostname nicht auflösbar';
    default:
      return code ?? (err instanceof Error ? err.message : 'Unbekannter Fehler');
  }
}
