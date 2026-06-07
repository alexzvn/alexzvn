import type { JmNdiApi } from '@shared/types';

declare global {
  interface Window {
    jmndi: JmNdiApi;
  }
}

export {};
