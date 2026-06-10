import { create } from 'zustand';
import type { SyncJob, SyncPreview, SyncProgress, SyncResult } from '@shared/types';

interface SyncStore {
  jobs: SyncJob[];
  selectedId: string | null;
  preview: SyncPreview | null;
  previewing: boolean;
  running: boolean;
  progress: SyncProgress | null;
  result: SyncResult | null;

  load: () => Promise<void>;
  select: (id: string | null) => void;
  createJob: (name: string) => Promise<void>;
  saveJob: (job: SyncJob) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  runPreview: (id: string) => Promise<void>;
  run: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  applyProgress: (p: SyncProgress) => void;
  applyDone: (r: SyncResult) => void;
}

export const useSync = create<SyncStore>((set, get) => ({
  jobs: [],
  selectedId: null,
  preview: null,
  previewing: false,
  running: false,
  progress: null,
  result: null,

  load: async () => {
    const jobs = await window.jmcp.sync.listJobs();
    set((s) => ({ jobs, selectedId: s.selectedId ?? jobs[0]?.id ?? null }));
  },
  select: (id) => set({ selectedId: id, preview: null, result: null }),

  createJob: async (name) => {
    const now = Date.now();
    const job: SyncJob = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Neuer Sync',
      sourcePath: '',
      targets: [],
      mirror: true,
      verify: false,
      createdAt: now,
      updatedAt: now,
    };
    await window.jmcp.sync.saveJob(job);
    await get().load();
    set({ selectedId: job.id, preview: null, result: null });
  },
  saveJob: async (job) => {
    const saved = await window.jmcp.sync.saveJob(job);
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === saved.id ? saved : j)) }));
  },
  removeJob: async (id) => {
    await window.jmcp.sync.removeJob(id);
    await get().load();
    if (get().selectedId === id) set({ selectedId: null, preview: null, result: null });
  },

  runPreview: async (id) => {
    set({ previewing: true, preview: null });
    try {
      const preview = await window.jmcp.sync.preview(id);
      set({ preview });
    } finally {
      set({ previewing: false });
    }
  },
  run: async (id) => {
    set({ running: true, progress: null, result: null });
    await window.jmcp.sync.run(id);
  },
  cancel: async (id) => {
    await window.jmcp.sync.cancel(id);
  },
  applyProgress: (p) => set({ progress: p }),
  applyDone: (r) => {
    set({ running: false, result: r, progress: null });
    void get().load();
  },
}));
