import { create } from 'zustand';
import type {
  FileProgress,
  FileStatus,
  JobProgress,
  JobResult,
  SourceItem,
} from '@shared/types';

export interface FileRow {
  relPath: string;
  sizeBytes: number;
  status: FileStatus;
  fileFraction: number;
  error?: string;
}

interface JobStore {
  running: boolean;
  jobId: string | null;
  rows: FileRow[];
  progress: JobProgress | null;
  result: JobResult | null;
  start: (jobId: string, files: SourceItem[]) => void;
  applyFile: (p: FileProgress) => void;
  applyJob: (p: JobProgress) => void;
  finish: (r: JobResult) => void;
  reset: () => void;
}

export const useJob = create<JobStore>((set) => ({
  running: false,
  jobId: null,
  rows: [],
  progress: null,
  result: null,
  start: (jobId, files) =>
    set({
      running: true,
      jobId,
      result: null,
      progress: null,
      rows: files.map((f) => ({
        relPath: f.relPath,
        sizeBytes: f.sizeBytes,
        status: 'pending' as FileStatus,
        fileFraction: 0,
      })),
    }),
  applyFile: (p) =>
    set((s) => {
      if (p.fileIndex < 0 || p.fileIndex >= s.rows.length) return s;
      const rows = s.rows.slice();
      rows[p.fileIndex] = {
        ...rows[p.fileIndex],
        status: p.status,
        fileFraction: p.fileFraction,
        error: p.error,
      };
      return { rows };
    }),
  applyJob: (p) => set({ progress: p }),
  finish: (r) => set({ running: false, result: r, progress: null }),
  reset: () => set({ running: false, jobId: null, rows: [], progress: null, result: null }),
}));
