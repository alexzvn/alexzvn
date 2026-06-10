import type { JmpromptApi } from '@shared/types';

declare global {
  interface Window {
    jmprompt: JmpromptApi;
  }
}

export {};
