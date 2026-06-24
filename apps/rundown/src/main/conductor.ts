// Conductor (Main): entdeckt die Steuer-Endpunkte der Suite per mDNS, mischt
// manuelle Overrides darüber (Cross-Subnet) und hält je Rolle einen
// SuiteControlClient (Auto-Reconnect). fire(role,line) sendet eine Protokollzeile;
// der STATE-Rückkanal (Tally) jedes Tools wird gecacht und nach außen gereicht.
// Verschwundene Tools (mDNS down, kein Override) werden abgeräumt. Steuer-
// Endpunkte tragen TXT ctl=1 (Switcher als Bestand ohne Marker). Nur im Main.
import { discover, type DiscoveredService, type Discovery } from '@jm/discovery';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import type { SuiteState } from '@jm/suite-control-protocol';
import { CAPABILITIES } from '@jm/suite-control-protocol/capabilities';
import { mergeEndpoints } from '@shared/conductor';
import type { Endpoint, ToolLink } from '@shared/types';

interface Link {
  role: string;
  host: string;
  port: number;
  source: 'mdns' | 'manual';
  client: SuiteControlClient;
  connected: boolean;
  state: Record<string, string> | null;
}

export class Conductor {
  private discovery: Discovery | null = null;
  private discovered: Record<string, Endpoint> = {};
  private overrides: Record<string, Endpoint> = {};
  private readonly links = new Map<string, Link>();

  constructor(private readonly onChange: () => void) {}

  start(): void {
    if (this.discovery) return;
    try {
      this.discovery = discover((svcs) => this.onDiscovered(svcs));
    } catch {
      /* mDNS optional — ohne Discovery laufen nur manuelle Overrides. */
    }
  }

  stop(): void {
    this.discovery?.stop();
    this.discovery = null;
    for (const l of this.links.values()) l.client.disconnect();
    this.links.clear();
  }

  /** Manuelle Endpunkt-Overrides setzen (leerer Eintrag = Override entfernen). */
  setOverrides(overrides: Record<string, Endpoint>): void {
    this.overrides = overrides;
    this.reconcile();
  }

  private isControl(s: DiscoveredService): boolean {
    // 'rundown' ausschließen — der Conductor dirigiert nicht sich selbst.
    return s.role !== 'rundown' && (s.ctl || s.role === 'switcher') && !!CAPABILITIES[s.role];
  }

  private onDiscovered(svcs: DiscoveredService[]): void {
    // Volle aktuelle Fundliste → discovered komplett neu aufbauen (handhabt auch
    // Verschwinden: ein abgemeldetes Tool fällt aus der Liste und wird abgeräumt).
    const next: Record<string, Endpoint> = {};
    for (const s of svcs) {
      if (this.isControl(s)) next[s.role] = { host: s.host, port: s.port };
    }
    this.discovered = next;
    this.reconcile();
  }

  /** Verbindungen an die gewünschten Endpunkte (mDNS + Overrides) angleichen. */
  private reconcile(): void {
    const want = mergeEndpoints(this.discovered, this.overrides);

    // Nicht (mehr) gewünschte oder umgezogene Links trennen.
    for (const [role, link] of this.links) {
      const w = want[role];
      if (!w || w.host !== link.host || w.port !== link.port) {
        link.client.disconnect();
        this.links.delete(role);
      }
    }

    // Fehlende Links aufbauen.
    for (const [role, w] of Object.entries(want)) {
      if (this.links.has(role)) continue;
      const client = new SuiteControlClient({
        onState: (st: SuiteState) => {
          const l = this.links.get(role);
          if (!l) return;
          l.state = coerceState(st);
          this.onChange();
        },
        onConnectedChange: (connected) => {
          const l = this.links.get(role);
          if (l) {
            l.connected = connected;
            if (!connected) l.state = null;
            this.onChange();
          }
        },
      });
      this.links.set(role, { role, host: w.host, port: w.port, source: w.source, client, connected: false, state: null });
      client.connect(w.host, w.port);
    }

    this.onChange();
  }

  /** Protokollzeile an das Tool der Rolle senden. true, wenn verbunden. */
  fire(role: string, line: string): boolean {
    const l = this.links.get(role);
    if (!l) return false;
    l.client.send(line);
    return l.connected;
  }

  snapshot(): ToolLink[] {
    return [...this.links.values()]
      .map((l) => ({
        role: l.role,
        label: CAPABILITIES[l.role]?.label ?? l.role,
        host: l.host,
        port: l.port,
        connected: l.connected,
        source: l.source,
        state: l.state,
      }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }
}

/** SuiteState.kv robust in Record<string,string> überführen. */
function coerceState(st: SuiteState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(st.kv ?? {})) out[k] = String(v);
  return out;
}
