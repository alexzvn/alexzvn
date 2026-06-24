import type { JmRundownApi } from '@shared/types';

declare global {
  interface Window {
    jmrundown: JmRundownApi;
  }
}

export {};
