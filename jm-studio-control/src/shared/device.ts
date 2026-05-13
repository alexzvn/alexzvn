import { z } from 'zod';

export const DeviceKindSchema = z.enum([
  'tricaster',
  'panasonic-ptz',
  'panasonic-rp',
  'aja-kumo',
  'ultimatte',
  'artnet-node',
  'switch',
  'taktgenerator',
  'unknown',
]);
export type DeviceKind = z.infer<typeof DeviceKindSchema>;

export const DeviceSchema = z.object({
  id: z.string().min(1),
  kind: DeviceKindSchema,
  name: z.string().min(1),
  ip: z.string().min(1),
  mac: z.string().optional(),
  model: z.string().optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  alias: z.string().optional(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const DeviceListSchema = z.array(DeviceSchema);
export type DeviceList = z.infer<typeof DeviceListSchema>;

export const DiscoveryProtocolSchema = z.enum([
  'mdns',
  'artpoll',
  'panasonic',
  'aja',
]);
export type DiscoveryProtocol = z.infer<typeof DiscoveryProtocolSchema>;

export const DiscoveredDeviceSchema = z.object({
  protocol: DiscoveryProtocolSchema,
  ip: z.string(),
  mac: z.string().optional(),
  model: z.string().optional(),
  name: z.string().optional(),
  vendor: z.string().optional(),
  ts: z.number(),
});
export type DiscoveredDevice = z.infer<typeof DiscoveredDeviceSchema>;
