import type { JmpsApi } from '@shared/types';

declare global {
  interface Window {
    jmps: JmpsApi;
  }
}

export {};
