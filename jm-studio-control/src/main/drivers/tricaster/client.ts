export class TricasterClient {
  constructor(
    private readonly host: string,
    private readonly port: number = 5951,
  ) {}

  private url(p: string): string {
    return `http://${this.host}:${this.port}${p}`;
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

  async version(): Promise<string | null> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(this.url('/v1/version'), { signal: ctrl.signal });
      if (!res.ok) return null;
      const text = await res.text();
      return text.trim() || 'unknown';
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }
}
