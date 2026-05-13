import dgram from 'node:dgram';
import type { DiscoveredDevice } from '@shared/device';
import type { DiscoveryProvider } from './types';

// Panasonic AW-series cameras and the AW-RP150 controller answer to a simple
// UDP search broadcast on port 60020. The official protocol is undocumented;
// this implementation sends a "SEARCH" magic packet (used by the AW Network
// Discovery app) and parses any text/binary response that contains an IPv4
// address. If the camera doesn't respond, fall back to mDNS / manual entry.

const SEARCH_PORTS = [60020, 60021];
const SEARCH_PAYLOAD = Buffer.from('SEARCH * HTTP/1.0\r\n\r\n', 'ascii');

export const panasonicProvider: DiscoveryProvider = {
  name: 'panasonic',
  async scan(timeoutMs: number): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const found = new Map<string, DiscoveredDevice>();

      const finish = (): void => {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        resolve([...found.values()]);
      };

      socket.on('error', finish);

      socket.on('message', (msg, rinfo) => {
        const text = msg.toString('utf-8');
        const vendor = guessPanasonicModel(text);
        if (!vendor) return;
        const key = rinfo.address;
        if (!found.has(key)) {
          found.set(key, {
            protocol: 'panasonic',
            ip: rinfo.address,
            name: vendor.name,
            model: vendor.model,
            vendor: 'Panasonic',
            ts: Date.now(),
          });
        }
      });

      socket.bind(0, () => {
        socket.setBroadcast(true);
        for (const port of SEARCH_PORTS) {
          socket.send(SEARCH_PAYLOAD, port, '255.255.255.255', () => {
            /* ignore */
          });
        }
      });

      setTimeout(finish, timeoutMs);
    });
  },
};

function guessPanasonicModel(
  text: string,
): { name: string; model: string } | null {
  const haystack = text.toLowerCase();
  if (haystack.includes('aw-ue150')) return { name: 'AW-UE150', model: 'AW-UE150' };
  if (haystack.includes('aw-rp150')) return { name: 'AW-RP150', model: 'AW-RP150' };
  if (haystack.includes('panasonic')) return { name: 'Panasonic', model: 'unknown' };
  return null;
}
