import type { JmcpApi } from '@shared/types';

declare global {
  interface Window {
    jmcp: JmcpApi;
  }
}

export {};
