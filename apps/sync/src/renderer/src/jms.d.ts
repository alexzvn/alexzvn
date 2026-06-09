import type { JmsApi } from '@shared/types';

declare global {
  interface Window {
    jms?: JmsApi;
  }
}

export {};
