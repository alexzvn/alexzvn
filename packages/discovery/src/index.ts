import { Bonjour } from 'bonjour-service';

/** Strukturelle Teilmenge eines Bonjour-Service — nur was wir wirklich lesen. */
interface MdnsService {
  txt?: Record<string, unknown> | null;
  addresses?: string[];
  host?: string;
  port: number;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// @jm/discovery — LAN-Auto-Discovery der Suite via mDNS/Bonjour.
//
// Quellen (Timer, Switcher, Presenter …) annoncieren sich als `_jmps._tcp` mit
// TXT-Records { appId, role }. Aggregatoren (z. B. Stage Display) finden sie und
// verbinden sich, ohne dass jemand IP/Port von Hand eintippen muss.
//
// Verallgemeinert das mDNS-Muster aus apps/studio-control auf die ganze Suite.
// Nutzt node-gebundene Multicast-Sockets → nur im Main-Prozess verwenden.
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_TYPE = 'jmps'; // → _jmps._tcp

export interface DiscoveredService {
  /** Tool-ID, z. B. "jm-timer" (aus dem TXT-Record). */
  appId: string;
  /** Frei wählbare Rolle, z. B. "timer" (aus dem TXT-Record). */
  role: string;
  /** IPv4-Adresse (bevorzugt) oder Hostname. */
  host: string;
  port: number;
  name: string;
}

export interface Advertiser {
  stop: () => void;
}

export interface Discovery {
  stop: () => void;
}

/** Veröffentlicht den eigenen Dienst im LAN als _jmps._tcp mit TXT {appId, role}. */
export function advertise(opts: {
  appId: string;
  role: string;
  port: number;
  name?: string;
}): Advertiser {
  const bonjour = new Bonjour();
  const service = bonjour.publish({
    name: opts.name ?? opts.appId,
    type: SERVICE_TYPE,
    port: opts.port,
    txt: { appId: opts.appId, role: opts.role },
  });
  return {
    stop: () => {
      try {
        service.stop?.();
      } catch {
        /* best-effort */
      }
      try {
        bonjour.destroy();
      } catch {
        /* best-effort */
      }
    },
  };
}

function toDiscovered(s: MdnsService): DiscoveredService | null {
  const txt = (s.txt ?? {}) as Record<string, unknown>;
  const appId = typeof txt.appId === 'string' ? txt.appId : '';
  if (!appId) return null;
  // IPv4 bevorzugen (z. B. für TCP/HTTP-Clients), sonst Hostname.
  const host = s.addresses?.find((a) => a.includes('.')) ?? s.host;
  if (!host) return null;
  return {
    appId,
    role: typeof txt.role === 'string' ? txt.role : '',
    host,
    port: s.port,
    name: s.name,
  };
}

/**
 * Sucht andere JM-Dienste im LAN. `onChange` wird mit der aktuellen Liste
 * gerufen, sobald ein Dienst auftaucht oder verschwindet.
 */
export function discover(onChange: (services: DiscoveredService[]) => void): Discovery {
  const bonjour = new Bonjour();
  const found = new Map<string, DiscoveredService>();
  const key = (d: DiscoveredService): string => `${d.appId}@${d.host}:${d.port}`;
  const emit = (): void => onChange([...found.values()]);

  const browser = bonjour.find({ type: SERVICE_TYPE }, (s: MdnsService) => {
    const d = toDiscovered(s);
    if (d) {
      found.set(key(d), d);
      emit();
    }
  });
  browser.on('down', (s: MdnsService) => {
    const d = toDiscovered(s);
    if (d && found.delete(key(d))) emit();
  });

  return {
    stop: () => {
      try {
        browser.stop();
      } catch {
        /* best-effort */
      }
      try {
        bonjour.destroy();
      } catch {
        /* best-effort */
      }
    },
  };
}
