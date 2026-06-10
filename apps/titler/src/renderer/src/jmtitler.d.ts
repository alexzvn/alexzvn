import type { JmtitlerApi } from '@shared/types';

declare global {
  interface Window {
    jmtitler: JmtitlerApi;
  }
}

export {};
