import type { JmBattleApi } from '@shared/types';

declare global {
  interface Window {
    jmbattle: JmBattleApi;
  }
}

export {};
