import type { JmgApi } from '@shared/types';

declare global {
  interface Window {
    jmg: JmgApi;
  }
}

export {};
