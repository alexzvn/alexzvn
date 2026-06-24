// Conductor (Main): entdeckt die Steuer-Endpunkte der Suite per mDNS und hält je
// Rolle einen SuiteControlClient (Auto-Reconnect). fire(role,line) sendet eine
// Protokollzeile an das passende Tool. Steuer-Endpunkte tragen TXT ctl=1 (der
// Switcher als Bestand ohne Marker) — dieselbe Disambiguierung wie im Companion-
// Modul. Nur im Main-Prozess (node:net + Multicast).
import { discover, type DiscoveredService, type Discovery } from '@jm/discovery';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import { CAPABILITIES } from '@jm/suite-control-protocol/capabilities';
import type { ToolLink } from '@shared/types';

interface Link {
  role: string;
  host: string;
  port: number;
  client: SuiteControlClient;
  connected: boolean;
}

export class Conductor {
  private discovery: Discovery | null = null;
  private readonly links = new Map<string, Link>();

  constructor(private readonly onChange: () => void) {}

  start(): void {
    if (this.discovery) return;
    try {
      this.discovery = discover((svcs) => this.onDiscovered(svcs));
    } catch {
      /* mDNS optional — ohne Discovery bleibt der Conductor leer (Slice 2: manuell). */
    }
  }

  stop(): void {
    this.discovery?.stop();
    this.discovery = null;
    for (const l of this.links.values()) l.client.disconnect();
    this.links.clear();
  }

  /** Ist der Dienst ein Suite-Steuer-Endpunkt? ctl=1 oder (Bestand) Switcher. */
  private isControl(s: DiscoveredService): boolean {
    return (s.ctl || s.role === 'switcher') && !!CAPABILITIES[s.role];
  }

  private onDiscovered(svcs: DiscoveredService[]): void {
    let changed = false;
    for (const s of svcs) {
      if (!this.isControl(s)) continue;
      const existing = this.links.get(s.role);
      if (existing) {
        if (existing.host === s.host && existing.port === s.port) continue;
        existing.client.disconnect(); // Endpunkt der Rolle hat gewechselt
      }
      const client = new SuiteControlClient({
        onState: () => {
          /* Slice 2: Tally/Status der Tools in den Renderer spiegeln */
        },
        onConnectedChange: (connected) => {
          const l = this.links.get(s.role);
          if (l) {
            l.connected = connected;
            this.onChange();
          }
        },
      });
      this.links.set(s.role, { role: s.role, host: s.host, port: s.port, client, connected: false });
      client.connect(s.host, s.port);
      changed = true;
    }
    if (changed) this.onChange();
  }

  /** Protokollzeile an das Tool der Rolle senden. Liefert true, wenn verbunden. */
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
      }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }
}
