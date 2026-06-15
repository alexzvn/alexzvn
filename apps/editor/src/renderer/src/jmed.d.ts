import type { JmedApi } from '@shared/ipc-types';

declare global {
  interface Window {
    jmed: JmedApi;
  }
}

export {};
