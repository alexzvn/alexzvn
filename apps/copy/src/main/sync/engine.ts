import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  SyncJob,
  SyncPlanItem,
  SyncPreview,
  SyncProgress,
  SyncResult,
  SyncTargetPlan,
  SyncTargetResult,
} from '@shared/types';
import { setLastRun } from './store';
import { scanTree, type Tree, type TreeEntry } from './scan-tree';
import { hashFile } from '../copy/hash';

// Toleranz für mtime-Vergleich (FAT/Netzwerk-Granularität).
const MTIME_TOLERANCE_MS = 2000;
// Max. Einträge je Ziel in der Vorschau (Anzeige), Zähler bleiben vollständig.
const PREVIEW_ITEM_CAP = 2000;

export interface SyncEmitter {
  progress(p: SyncProgress): void;
  done(r: SyncResult): void;
}
let emitter: SyncEmitter | null = null;
export function setSyncEmitter(e: SyncEmitter): void {
  emitter = e;
}

interface SyncState {
  canceled: boolean;
}
const states = new Map<string, SyncState>();
export function cancelSync(id: string): void {
  const s = states.get(id);
  if (s) s.canceled = true;
}

class CanceledError extends Error {}

function osPath(base: string, relPosix: string): string {
  return path.join(base, ...relPosix.split('/'));
}

async function reachable(dir: string): Promise<boolean> {
  try {
    await fs.stat(dir);
    return true;
  } catch {
    return false;
  }
}

function changed(src: TreeEntry, dst: TreeEntry): boolean {
  if (src.sizeBytes !== dst.sizeBytes) return true;
  return Math.abs(src.mtimeMs - dst.mtimeMs) > MTIME_TOLERANCE_MS;
}

interface TargetPlan {
  copy: TreeEntry[];
  update: TreeEntry[];
  del: string[]; // relPaths, nur bei mirror
  bytes: number;
}

/** Quelle vs. Ziel diffen. Zielbaum wird hier gescannt. */
async function planTarget(srcTree: Tree, targetPath: string, mirror: boolean): Promise<TargetPlan> {
  const dst = await scanTree(targetPath);
  const copy: TreeEntry[] = [];
  const update: TreeEntry[] = [];
  let bytes = 0;
  for (const [rel, s] of srcTree.entries) {
    const d = dst.entries.get(rel);
    if (!d) {
      copy.push(s);
      bytes += s.sizeBytes;
    } else if (changed(s, d)) {
      update.push(s);
      bytes += s.sizeBytes;
    }
  }
  const del: string[] = [];
  if (mirror) {
    for (const rel of dst.entries.keys()) {
      if (!srcTree.entries.has(rel)) del.push(rel);
    }
  }
  return { copy, update, del, bytes };
}

export async function buildPreview(job: SyncJob): Promise<SyncPreview> {
  if (!(await reachable(job.sourcePath))) {
    return { jobId: job.id, sourceMissing: true, totalFiles: 0, totalBytes: 0, targets: [] };
  }
  const srcTree = await scanTree(job.sourcePath);
  const targets: SyncTargetPlan[] = [];
  let totalFiles = 0;
  let totalBytes = 0;

  for (const target of job.targets) {
    if (!(await reachable(target.path))) {
      targets.push({
        targetId: target.id,
        targetPath: target.path,
        reachable: false,
        copy: 0,
        update: 0,
        del: 0,
        bytes: 0,
        items: [],
        error: 'Ziel nicht erreichbar',
      });
      continue;
    }
    const plan = await planTarget(srcTree, target.path, job.mirror);
    const items: SyncPlanItem[] = [];
    for (const e of plan.copy) items.push({ relPath: e.relPath, action: 'copy', sizeBytes: e.sizeBytes });
    for (const e of plan.update) items.push({ relPath: e.relPath, action: 'update', sizeBytes: e.sizeBytes });
    for (const rel of plan.del) items.push({ relPath: rel, action: 'delete', sizeBytes: 0 });
    targets.push({
      targetId: target.id,
      targetPath: target.path,
      reachable: true,
      copy: plan.copy.length,
      update: plan.update.length,
      del: plan.del.length,
      bytes: plan.bytes,
      items: items.slice(0, PREVIEW_ITEM_CAP),
    });
    totalFiles += plan.copy.length + plan.update.length + plan.del.length;
    totalBytes += plan.bytes;
  }

  return { jobId: job.id, sourceMissing: false, totalFiles, totalBytes, targets };
}

async function pruneEmptyDirs(dir: string, root: string): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) await pruneEmptyDirs(path.join(dir, e.name), root);
  }
  if (dir !== root) {
    try {
      const rest = await fs.readdir(dir);
      if (rest.length === 0) await fs.rmdir(dir);
    } catch {
      // nicht leer / nicht löschbar → belassen
    }
  }
}

async function copyOne(src: TreeEntry, targetPath: string, verify: boolean): Promise<void> {
  const dest = osPath(targetPath, src.relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src.path, dest);
  // mtime erhalten → der schnelle Größe+mtime-Check erkennt die Datei künftig als unverändert.
  try {
    await fs.utimes(dest, new Date(), new Date(src.mtimeMs));
  } catch {
    // utimes best-effort
  }
  if (verify) {
    const [a, b] = await Promise.all([hashFile(src.path, false), hashFile(dest, false)]);
    if (a.xxhash64 !== b.xxhash64) throw new Error('Prüfsumme stimmt nicht überein');
  }
}

export function isSyncing(jobId: string): boolean {
  return states.has(jobId);
}

export async function runSync(job: SyncJob): Promise<void> {
  // Kein zweiter parallel laufender Sync desselben Jobs (Auto + manuell).
  if (states.has(job.id)) return;
  const state: SyncState = { canceled: false };
  states.set(job.id, state);
  const startedAtMs = Date.now();

  let bytesTotal = 1;
  let filesTotal = 0;
  let bytesDone = 0;
  let filesDone = 0;
  let copied = 0;
  let deleted = 0;
  let failed = 0;
  let lastEmit = 0;
  let canceled = false;
  const targetResults: SyncTargetResult[] = [];

  const emit = (phase: SyncProgress['phase'], targetPath: string, rel: string, force = false): void => {
    const now = Date.now();
    if (!force && now - lastEmit < 100) return;
    lastEmit = now;
    const elapsed = (now - startedAtMs) / 1000;
    const bytesPerSec = elapsed > 0 ? bytesDone / elapsed : 0;
    const etaSec = bytesPerSec > 0 ? Math.max(0, (bytesTotal - bytesDone) / bytesPerSec) : 0;
    emitter?.progress({
      jobId: job.id,
      phase,
      targetPath,
      filesDone,
      filesTotal,
      bytesDone,
      bytesTotal,
      bytesPerSec,
      etaSec,
      currentRelPath: rel,
    });
  };

  const finish = (): void => {
    const finishedAtMs = Date.now();
    const summary = {
      at: finishedAtMs,
      copied,
      deleted,
      failed,
      bytes: bytesDone,
      durationMs: finishedAtMs - startedAtMs,
      canceled,
    };
    setLastRun(job.id, summary);
    states.delete(job.id);
    emitter?.done({ jobId: job.id, ...summary, targets: targetResults });
  };

  // Quelle scannen.
  if (!(await reachable(job.sourcePath))) {
    failed = 1;
    finish();
    return;
  }
  const srcTree = await scanTree(job.sourcePath);

  // Erst alle Ziele planen → Gesamt-Summen für Fortschritt/ETA.
  const plans: { target: SyncJob['targets'][number]; plan: TargetPlan; reachable: boolean }[] = [];
  for (const target of job.targets) {
    const ok = await reachable(target.path);
    if (!ok) {
      plans.push({ target, plan: { copy: [], update: [], del: [], bytes: 0 }, reachable: false });
      targetResults.push({
        targetId: target.id,
        targetPath: target.path,
        copied: 0,
        deleted: 0,
        failed: 0,
        error: 'Ziel nicht erreichbar',
      });
      failed++;
      continue;
    }
    const plan = await planTarget(srcTree, target.path, job.mirror);
    plans.push({ target, plan, reachable: true });
    bytesTotal += plan.bytes;
    filesTotal += plan.copy.length + plan.update.length + plan.del.length;
  }

  emit('compare', job.sourcePath, '', true);

  // Ausführen.
  for (const { target, plan, reachable: ok } of plans) {
    if (!ok) continue;
    let tCopied = 0;
    let tDeleted = 0;
    let tFailed = 0;

    const toWrite = [...plan.copy, ...plan.update];
    for (const entry of toWrite) {
      if (state.canceled) {
        canceled = true;
        break;
      }
      try {
        await copyOne(entry, target.path, job.verify);
        bytesDone += entry.sizeBytes;
        copied++;
        tCopied++;
      } catch {
        failed++;
        tFailed++;
      }
      filesDone++;
      emit('copy', target.path, entry.relPath);
    }

    if (!state.canceled && job.mirror) {
      for (const rel of plan.del) {
        if (state.canceled) {
          canceled = true;
          break;
        }
        try {
          await fs.rm(osPath(target.path, rel), { force: true });
          deleted++;
          tDeleted++;
        } catch {
          failed++;
          tFailed++;
        }
        filesDone++;
        emit('delete', target.path, rel);
      }
      if (plan.del.length > 0) await pruneEmptyDirs(target.path, target.path).catch(() => {});
    }

    targetResults.push({
      targetId: target.id,
      targetPath: target.path,
      copied: tCopied,
      deleted: tDeleted,
      failed: tFailed,
    });

    if (state.canceled) {
      canceled = true;
      break;
    }
  }

  finish();
}
