import type { JmQaApi } from '@shared/types';

declare global {
  interface Window {
    jmqa: JmQaApi;
  }
}

export {};
