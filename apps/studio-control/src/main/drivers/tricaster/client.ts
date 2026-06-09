import { DEFAULT_TRICASTER_PORT } from '@shared/tricaster';

export interface VersionResult {
  ok: boolean;
  version?: string;
  error?: string;
}

export class TricasterClient {
  constructor(
    private readonly host: string,
    private readonly port: number = DEFAULT_TRICASTER_PORT,
  ) {}

  private url(p: string): string {
    // Port 80 is the HTTP default — omit it so the URL stays clean and works
    // even with proxies that dislike an explicit :80.
    const authority = this.port === 80 ? this.host : `${this.host}:${this.port}`;
    return `http://${authority}${p}`;
  }

  async shortcut(name: string, params?: Record<string, string>): Promise<void> {
    const qs = new URLSearchParams({ name, ...(params ?? {}) }).toString();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch(this.url(`/v1/shortcut?${qs}`), {
        method: 'GET',
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`shortcut ${name} HTTP ${res.status}`);
      }
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Probes the TriCaster HTTP API. Returns a structured result so the UI can
   * show *why* a connection failed (refused / timeout / 404 / 401) instead of
   * a bare "Offline".
   */
  async version(): Promise<VersionResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    try {
      const res = await fetch(this.url('/v1/version'), { signal: ctrl.signal });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status} auf /v1/version` };
      }
      const text = await res.text();
      return { ok: true, version: text.trim() || 'unknown' };
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
