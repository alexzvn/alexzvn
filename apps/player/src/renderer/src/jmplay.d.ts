import type { JmplayApi } from '@shared/types';

declare global {
  interface Window {
    jmplay: JmplayApi;
  }
}

export {};
