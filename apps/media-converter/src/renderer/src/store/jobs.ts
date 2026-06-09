import { create } from 'zustand';
import type { JobKind, JobStatus } from '@shared/types';

export interface JobItem {
  id: string;
  kind: JobKind;
  status: JobStatus;
  inputPath: string;
  fileName: string;
  presetLabel?: string;
  percent: number;
  fps?: number;
  speed?: string;
  etaSec?: number;
  outputPath?: string;
  error?: string;
}

interface JobsState {
  jobs: JobItem[];
  add: (job: JobItem) => void;
  patch: (id: string, partial: Partial<JobItem>) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
}

const FINISHED: JobStatus[] = ['done', 'error', 'canceled'];

export const useJobs = create<JobsState>((set) => ({
  jobs: [],
  add: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
  patch: (id, partial) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...partial } : j)),
    })),
  remove: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  clearFinished: () =>
    set((s) => ({ jobs: s.jobs.filter((j) => !FINISHED.includes(j.status)) })),
}));
