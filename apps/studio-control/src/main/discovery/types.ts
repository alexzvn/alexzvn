import type { DiscoveredDevice } from '@shared/device';

export interface DiscoveryProvider {
  name: string;
  scan(timeoutMs: number): Promise<DiscoveredDevice[]>;
}
