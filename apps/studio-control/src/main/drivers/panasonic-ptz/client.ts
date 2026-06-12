import { buildAwCommand, DEFAULT_PTZ_PORT, type PtzAction } from '@shared/ptz';

export interface PtzProbeResult {
  ok: boolean;
  power?: 'on' | 'standby';
  error?: string;
}

/**
 * Thin client for the Panasonic AW HTTP CGI control API. One instance per
 * camera; stateless apart from host/port (mirrors TricasterClient).
 */
export class PanasonicPtzClient {
  constructor(
    private readonly host: string,
    private readonly port: number = DEFAULT_PTZ_PORT,
  ) {}

  private url(cgi: string, cmd: string): string {
    const authority = this.port === 80 ? this.host : `${this.host}:${this.port}`;
    // res=1 makes the camera return the command response in the HTTP body.
    const qs = new URLSearchParams({ cmd, res: '1' }).toString();
    return `http://${authority}/cgi-bin/${cgi}?${qs}`;
  }

  /** Send a control action; resolves when the camera acknowledges (HTTP 200). */
  async send(action: PtzAction): Promise<string> {
    const { cgi, cmd } = buildAwCommand(action);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch(this.url(cgi, cmd), { method: 'GET', signal: ctrl.signal });
      if (!res.ok) {
        throw new Error(`${cmd} HTTP ${res.status}`);
      }
      const body = (await res.text()).trim();
      // AW cameras answer an unsupported/invalid command with "ER1"/"ER2"/"ER3".
      if (/^er\d/i.test(body)) {
        throw new Error(`${cmd} abgelehnt (${body})`);
      }
      return body;
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Reachability probe via the power-status query `#O` — answered by every AW
   * camera with `p1` (on) / `p0` (standby). Returns a structured result so the
   * UI can show *why* a camera is unreachable, like the TriCaster probe.
   */
  async probe(): Promise<PtzProbeResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    try {
      const res = await fetch(this.url('aw_ptz', '#O'), { signal: ctrl.signal });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status} auf /cgi-bin/aw_ptz` };
      }
      const body = (await res.text()).trim().toLowerCase();
      const power = body.startsWith('p1') ? 'on' : body.startsWith('p0') ? 'standby' : undefined;
      return { ok: true, power };
    } catch (err) {
      return { ok: false, error: describeFetchError(err) };
    } finally {
      clearTimeout(t);
    }
  }
}

function describeFetchError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Zeitüberschreitung (keine Antwort)';
  }
  const cause = (err as { cause?: { code?: string } })?.cause;
  switch (cause?.code) {
    case 'ECONNREFUSED':
      return 'Verbindung abgelehnt — falscher Port?';
    case 'EHOSTUNREACH':
      return 'Host nicht erreichbar — Netzwerk/VLAN prüfen';
    case 'ENETUNREACH':
      return 'Netzwerk nicht erreichbar';
    case 'ETIMEDOUT':
      return 'Zeitüberschreitung';
    case 'ECONNRESET':
      return 'Verbindung zurückgesetzt';
    case 'ENOTFOUND':
      return 'Hostname nicht auflösbar';
    default:
      return cause?.code ?? (err instanceof Error ? err.message : 'Unbekannter Fehler');
  }
}
