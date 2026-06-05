import { Bonjour } from 'bonjour-service';
import type { DiscoveredDevice } from '@shared/device';
import type { DiscoveryProvider } from './types';

const SERVICE_TYPES = ['http', 'ndi', 'aja-control'];

export const mdnsProvider: DiscoveryProvider = {
  name: 'mdns',
  async scan(timeoutMs: number): Promise<DiscoveredDevice[]> {
    const bonjour = new Bonjour();
    const seen = new Map<string, DiscoveredDevice>();

    const browsers = SERVICE_TYPES.map((type) =>
      bonjour.find({ type }, (service) => {
        const ip = service.addresses?.find((a) => a.includes('.')) ?? service.host;
        if (!ip) return;
        const key = `${ip}:${service.name}`;
        const vendor = guessVendor(service.name, service.txt);
        seen.set(key, {
          protocol: 'mdns',
          ip,
          name: service.name,
          model: service.fqdn,
          vendor,
          ts: Date.now(),
        });
      }),
    );

    await new Promise((r) => setTimeout(r, timeoutMs));

    for (const b of browsers) b.stop();
    bonjour.destroy();

    return [...seen.values()];
  },
};

function guessVendor(
  name: string | undefined,
  txt: Record<string, string | true> | undefined,
): string | undefined {
  if (!name && !txt) return undefined;
  const hay = `${name ?? ''} ${JSON.stringify(txt ?? {})}`.toLowerCase();
  if (hay.includes('tricaster') || hay.includes('newtek')) return 'NewTek';
  if (hay.includes('panasonic') || hay.includes('aw-ue') || hay.includes('aw-rp')) return 'Panasonic';
  if (hay.includes('aja') || hay.includes('kumo')) return 'AJA';
  if (hay.includes('blackmagic') || hay.includes('ultimatte')) return 'Blackmagic';
  return undefined;
}
