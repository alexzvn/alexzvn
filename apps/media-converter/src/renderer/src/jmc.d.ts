import type { JmcApi } from '@shared/types';

declare global {
  interface Window {
    jmc: JmcApi;
  }
}

export {};
