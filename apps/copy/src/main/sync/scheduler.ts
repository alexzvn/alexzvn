import { watch, type FSWatcher } from 'node:fs';
import type { SyncJob } from '@shared/types';
import { getJob, listJobs } from './store';
import { runSync } from './engine';

// Entprellzeit nach der letzten Quell-Änderung, bevor ein Watch-Sync startet.
const WATCH_DEBOUNCE_MS = 1500;
const MIN_INTERVAL_SEC = 10;

interface Runner {
  watcher?: FSWatcher;
  interval?: ReturnType<typeof setInterval>;
  debounce?: ReturnType<typeof setTimeout>;
  running: boolean;
  pending: boolean;
}

const runners = new Map<string, Runner>();

async function trigger(jobId: string): Promise<void> {
  const r = runners.get(jobId);
  if (!r) return;
  if (r.running) {
    r.pending = true; // während eines Laufs eingegangene Trigger zusammenfassen
    return;
  }
  const job = getJob(jobId);
  if (!job) return;
  r.running = true;
  try {
    await runSync(job);
  } catch {
    // Fehler werden über das Done-Event gemeldet
  }
  r.running = false;
  if (r.pending) {
    r.pending = false;
    void trigger(jobId);
  }
}

function stopRunner(jobId: string): void {
  const r = runners.get(jobId);
  if (!r) return;
  r.watcher?.close();
  if (r.interval) clearInterval(r.interval);
  if (r.debounce) clearTimeout(r.debounce);
  runners.delete(jobId);
}

function startRunner(job: SyncJob): void {
  stopRunner(job.id);
  const auto = job.auto;
  if (!auto || auto.mode === 'off') return;
  if (!job.sourcePath || job.targets.length === 0) return;

  const r: Runner = { running: false, pending: false };
  runners.set(job.id, r);

  if (auto.mode === 'interval') {
    const ms = Math.max(MIN_INTERVAL_SEC, auto.intervalSec ?? 300) * 1000;
    r.interval = setInterval(() => void trigger(job.id), ms);
  } else if (auto.mode === 'watch') {
    try {
      // recursive wird auf Windows/macOS unterstützt (die Zielplattformen);
      // auf Linux wirft es ggf. → dann kein Watch (Dev-Umgebung).
      r.watcher = watch(job.sourcePath, { recursive: true }, () => {
        if (r.debounce) clearTimeout(r.debounce);
        r.debounce = setTimeout(() => void trigger(job.id), WATCH_DEBOUNCE_MS);
      });
    } catch {
      // Watch nicht möglich → Runner bleibt ohne Auslöser bestehen (no-op).
    }
  }
}

/** Alle Runner anhand des aktuellen Job-Stands neu aufsetzen. */
export function rescheduleAll(): void {
  for (const id of [...runners.keys()]) stopRunner(id);
  for (const job of listJobs()) startRunner(job);
}

/** Einen Job neu planen (nach Speichern/Löschen). */
export function rescheduleJob(jobId: string): void {
  const job = getJob(jobId);
  if (job) startRunner(job);
  else stopRunner(jobId);
}

export function stopAllRunners(): void {
  for (const id of [...runners.keys()]) stopRunner(id);
}
