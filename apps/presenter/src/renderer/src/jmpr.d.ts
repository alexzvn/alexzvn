import type { JmprApi } from '@shared/types';

declare global {
  interface Window {
    jmpr: JmprApi;
  }
}

export {};
