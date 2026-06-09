import type { JmswitchApi } from '@shared/types';

declare global {
  interface Window {
    jmswitch: JmswitchApi;
  }
}

export {};
