import type { JmtranscribeApi } from '@shared/types';

declare global {
  interface Window {
    jmtranscribe: JmtranscribeApi;
  }
}

export {};
