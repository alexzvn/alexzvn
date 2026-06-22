import type { JmdawApi } from '@shared/ipc-types';

declare global {
  interface Window {
    jmdaw: JmdawApi;
  }
}

export {};
