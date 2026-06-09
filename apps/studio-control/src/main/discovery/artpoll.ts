import dgram from 'node:dgram';
import { networkInterfaces } from 'node:os';
import type { DiscoveredDevice } from '@shared/device';
import type { DiscoveryProvider } from './types';

const ARTNET_PORT = 6454;
const ART_POLL_OPCODE = 0x2000;
const ART_POLL_REPLY_OPCODE = 0x2100;

function buildArtPoll(): Buffer {
  const buf = Buffer.alloc(14);
  buf.write('Art-Net\0', 0, 'ascii');
  buf.writeUInt16LE(ART_POLL_OPCODE, 8);
  buf.writeUInt16BE(14, 10); // protVer
  buf.writeUInt8(0x02, 12); // TalkToMe
  buf.writeUInt8(0xe0, 13); // Priority (DpAll)
  return buf;
}

function broadcastAddresses(): string[] {
  const out: string[] = ['255.255.255.255'];
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      const addrParts = iface.address.split('.').map(Number);
      const maskParts = iface.netmask.split('.').map(Number);
      if (addrParts.length !== 4 || maskParts.length !== 4) continue;
      const bcast = addrParts
        .map((b, i) => (b & maskParts[i]!) | (~maskParts[i]! & 0xff))
        .join('.');
      if (!out.includes(bcast)) out.push(bcast);
    }
  }
  return out;
}

function parseReply(msg: Buffer, rinfo: dgram.RemoteInfo): DiscoveredDevice | null {
  if (msg.length < 207) return null;
  if (msg.slice(0, 8).toString('ascii') !== 'Art-Net\0') return null;
  if (msg.readUInt16LE(8) !== ART_POLL_REPLY_OPCODE) return null;

  const ip = `${msg.readUInt8(10)}.${msg.readUInt8(11)}.${msg.readUInt8(12)}.${msg.readUInt8(13)}`;
  const shortName = msg.slice(26, 26 + 18).toString('ascii').replace(/\0.*$/, '').trim();
  const longName = msg.slice(44, 44 + 64).toString('ascii').replace(/\0.*$/, '').trim();
  const macOffset = 201;
  const mac = [...Array(6)]
    .map((_, i) => msg.readUInt8(macOffset + i).toString(16).padStart(2, '0'))
    .join(':');

  return {
    protocol: 'artpoll',
    ip: ip === '0.0.0.0' ? rinfo.address : ip,
    mac: mac === '00:00:00:00:00:00' ? undefined : mac,
    name: shortName || undefined,
    model: longName || undefined,
    vendor: longName.toLowerCase().includes('eurolite')
      ? 'Eurolite'
      : longName.toLowerCase().includes('aputure')
        ? 'Aputure'
        : undefined,
    ts: Date.now(),
  };
}

export const artpollProvider: DiscoveryProvider = {
  name: 'artpoll',
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

      socket.on('error', () => {
        finish();
      });

      socket.on('message', (msg, rinfo) => {
        const dev = parseReply(msg, rinfo);
        if (!dev) return;
        const key = dev.mac ?? dev.ip;
        if (!found.has(key)) found.set(key, dev);
      });

      socket.bind(0, () => {
        socket.setBroadcast(true);
        const poll = buildArtPoll();
        for (const addr of broadcastAddresses()) {
          socket.send(poll, ARTNET_PORT, addr, () => {
            /* ignore individual send errors */
          });
        }
      });

      setTimeout(finish, timeoutMs);
    });
  },
};
