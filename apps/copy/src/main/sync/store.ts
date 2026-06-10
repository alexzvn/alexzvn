import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SyncJob, SyncRunSummary } from '@shared/types';

/** Persistenz der Sync-Jobs als JSON in userData (Main-seitig, da der Sync dort läuft). */
function jobsFile(): string {
  return join(app.getPath('userData'), 'sync-jobs.json');
}

function readAll(): SyncJob[] {
  try {
    if (existsSync(jobsFile())) {
      const data = JSON.parse(readFileSync(jobsFile(), 'utf8')) as SyncJob[];
      if (Array.isArray(data)) return data;
    }
  } catch {
    // korrupte Datei ignorieren
  }
  return [];
}

function writeAll(jobs: SyncJob[]): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(jobsFile(), JSON.stringify(jobs, null, 2));
}

export function listJobs(): SyncJob[] {
  return readAll();
}

export function getJob(id: string): SyncJob | null {
  return readAll().find((j) => j.id === id) ?? null;
}

/** Upsert anhand id; liefert den gespeicherten Job zurück. */
export function saveJob(job: SyncJob): SyncJob {
  const jobs = readAll();
  const idx = jobs.findIndex((j) => j.id === job.id);
  const stored: SyncJob = { ...job, updatedAt: Date.now() };
  if (idx >= 0) jobs[idx] = stored;
  else jobs.push(stored);
  writeAll(jobs);
  return stored;
}

export function removeJob(id: string): void {
  writeAll(readAll().filter((j) => j.id !== id));
}

export function setLastRun(id: string, summary: SyncRunSummary): void {
  const jobs = readAll();
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  job.lastRun = summary;
  writeAll(jobs);
}
