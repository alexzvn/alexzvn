import type { JmCaptionApi } from '@shared/types';

declare global {
  interface Window {
    jmcaption: JmCaptionApi;
  }
}

export {};
