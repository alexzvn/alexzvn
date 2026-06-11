import { create } from 'zustand';
import { CHANGELOG } from '@jm/suite-manifest';
import type { AppChangelog, ChangelogEntry } from '@shared/types';

// Patch Notes: anfangs der gebündelte Stand (Offline-Erststart), dann live vom
// Proxy nachgeladen (Issue #19). `changelogFor`/`entryFor` lesen den aktuellen
// In-memory-Stand, sodass Komponenten beim Live-Update neu rendern.
interface ChangelogStore {
  data: AppChangelog[];
  load: () => Promise<void>;
  changelogFor: (app: string) => AppChangelog | undefined;
  entryFor: (app: string, version: string) => ChangelogEntry | undefined;
}

export const useChangelog = create<ChangelogStore>((set, get) => ({
  data: CHANGELOG as AppChangelog[],
  load: async () => {
    try {
      const live = await window.jmps.getChangelog();
      if (Array.isArray(live) && live.length) set({ data: live });
    } catch {
      // offline / Quelle nicht erreichbar → gebündelten Stand behalten
    }
  },
  changelogFor: (app) => get().data.find((c) => c.app === app),
  entryFor: (app, version) => get().data.find((c) => c.app === app)?.entries.find((e) => e.version === version),
}));
