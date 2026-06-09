import type { JmrecApi } from '@shared/types';

declare global {
  interface Window {
    jmrec: JmrecApi;
  }
}

export {};
