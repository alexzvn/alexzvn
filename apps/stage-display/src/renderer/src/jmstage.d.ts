import type { JmstageApi } from '@shared/types';

declare global {
  interface Window {
    jmstage: JmstageApi;
  }
}

export {};
