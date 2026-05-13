import { load, save } from './store';
import { DeviceListSchema, type Device, type DeviceList } from '@shared/device';

const FILE = 'devices.json';
const listeners = new Set<(list: DeviceList) => void>();
let cache: DeviceList = [];

export function loadDevices(): DeviceList {
  cache = load(FILE, DeviceListSchema, []);
  return cache;
}

export function getDevices(): DeviceList {
  return cache;
}

export function upsertDevice(device: Device): DeviceList {
  const idx = cache.findIndex((d) => d.id === device.id);
  if (idx >= 0) {
    cache = [...cache.slice(0, idx), device, ...cache.slice(idx + 1)];
  } else {
    cache = [...cache, device];
  }
  save(FILE, cache, DeviceListSchema);
  notify();
  return cache;
}

export function removeDevice(id: string): DeviceList {
  cache = cache.filter((d) => d.id !== id);
  save(FILE, cache, DeviceListSchema);
  notify();
  return cache;
}

export function onDevicesChange(cb: (list: DeviceList) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(): void {
  for (const l of listeners) l(cache);
}
