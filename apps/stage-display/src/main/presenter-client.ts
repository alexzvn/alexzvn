import { request, type ClientRequest, type IncomingMessage } from 'node:http';
import type { PresenterScreen, PresenterSource } from '@shared/types';

export const PRESENTER_OFFLINE: PresenterSource = {
  connected: false,
  active: false,
  index: 0,
  total: 0,
  title: '',
  notes: '',
  nextTitle: null,
  screen: 'live',
};

const RECONNECT_MS = 2000;

/** The compact view the JM Presenter remote broadcasts over SSE (`/events`). */
interface IncomingView {
  active: boolean;
  index: number;
  total: number;
  screen: PresenterScreen;
  title: string;
  notes: string;
  nextTitle: string | null;
}

/**
 * Server-Sent-Events client onto the JM Presenter's network remote (`/events`,
 * default port 7330). The presenter already pushes its live reference view
 * (current/next title, notes, position) to connected phones — we tap the same
 * stream so the stage display can mirror it. Node has no EventSource, so we read
 * the chunked stream and split on the SSE record separator ("\n\n") ourselves.
 *
 * The presenter must have its Fernsteuerung (network remote) enabled. If that
 * remote runs with a PIN, pass it through; a PIN-less remote needs no token.
 */
export class PresenterClient {
  private req: ClientRequest | null = null;
  private res: IncomingMessage | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private host = '';
  private port = 0;
  private pin = '';
  private buf = '';
  private readonly onChange: (s: PresenterSource) => void;

  constructor(onChange: (s: PresenterSource) => void) {
    this.onChange = onChange;
  }

  connect(host: string, port: number, pin: string): void {
    this.disconnect();
    this.active = true;
    this.host = host;
    this.port = port;
    this.pin = pin;
    this.open();
  }

  private open(): void {
    if (!this.active) return;
    this.buf = '';
    const path = this.pin ? `/events?pin=${encodeURIComponent(this.pin)}` : '/events';
    const req = request(
      { host: this.host, port: this.port, path, method: 'GET', headers: { Accept: 'text/event-stream' } },
      (res) => {
        if (res.statusCode !== 200) {
          // 401 = PIN required/wrong; anything else = not reachable. Drain + retry.
          res.resume();
          this.onChange({ ...PRESENTER_OFFLINE });
          this.scheduleReconnect();
          return;
        }
        this.res = res;
        res.setEncoding('utf8');
        // Reachable: mark connected even before the first slide event arrives.
        this.onChange({ ...PRESENTER_OFFLINE, connected: true });
        res.on('data', (chunk: string) => this.feed(chunk));
        res.on('end', () => {
          this.onChange({ ...PRESENTER_OFFLINE });
          this.scheduleReconnect();
        });
      },
    );
    req.on('error', () => {
      this.onChange({ ...PRESENTER_OFFLINE });
      this.scheduleReconnect();
    });
    req.end();
    this.req = req;
  }

  /** Accumulate the stream and parse complete "\n\n"-delimited SSE records. */
  private feed(chunk: string): void {
    this.buf += chunk;
    let sep: number;
    while ((sep = this.buf.indexOf('\n\n')) >= 0) {
      const record = this.buf.slice(0, sep);
      this.buf = this.buf.slice(sep + 2);
      this.handleRecord(record);
    }
  }

  private handleRecord(record: string): void {
    for (const line of record.split('\n')) {
      if (!line.startsWith('data:')) continue; // skip comments (": ping") and "retry:"
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        this.onChange(this.map(JSON.parse(json) as IncomingView));
      } catch {
        /* ignore malformed records */
      }
    }
  }

  private map(v: IncomingView): PresenterSource {
    return {
      connected: true,
      active: v.active === true,
      index: Number.isFinite(v.index) ? v.index : 0,
      total: Number.isFinite(v.total) ? v.total : 0,
      title: typeof v.title === 'string' ? v.title : '',
      notes: typeof v.notes === 'string' ? v.notes : '',
      nextTitle: typeof v.nextTitle === 'string' ? v.nextTitle : null,
      screen: v.screen === 'black' || v.screen === 'white' ? v.screen : 'live',
    };
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
    if (this.res) {
      this.res.removeAllListeners();
      this.res.destroy();
      this.res = null;
    }
    if (this.req) {
      this.req.removeAllListeners();
      this.req.destroy();
      this.req = null;
    }
    this.onChange({ ...PRESENTER_OFFLINE });
  }
}
