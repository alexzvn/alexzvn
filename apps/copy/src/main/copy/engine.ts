import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CopySpec,
  Destination,
  FileProgress,
  FileResult,
  FileStatus,
  JobProgress,
  JobResult,
  SourceItem,
} from '@shared/types';
import { createRunningHash, hashFile, type Hashes } from './hash';
import { writeMhl, type MhlEntry } from './mhl';

export interface CopyEmitter {
  fileProgress(p: FileProgress): void;
  jobProgress(p: JobProgress): void;
  done(r: JobResult): void;
}

let emitter: CopyEmitter | null = null;
export function setCopyEmitter(e: CopyEmitter): void {
  emitter = e;
}

interface JobState {
  canceled: boolean;
}
const jobs = new Map<string, JobState>();

export function cancelCopy(jobId: string): void {
  const state = jobs.get(jobId);
  if (state) state.canceled = true;
}

class CanceledError extends Error {}

function osPath(base: string, relPosix: string): string {
  return path.join(base, ...relPosix.split('/'));
}

/** Absolute resolved master folder for a destination. */
function destFolder(d: Destination): string {
  return d.subPath ? osPath(d.basePath, d.subPath) : d.basePath;
}

function writeChunk(stream: import('node:fs').WriteStream, chunk: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (err) => (err ? reject(err) : resolve()));
  });
}

function endStream(stream: import('node:fs').WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.end(() => resolve());
  });
}

/** Read the source once, fan out to every destination, hashing as we go. */
async function copyAndHash(
  src: string,
  destPaths: string[],
  withMd5: boolean,
  state: JobState,
  onWork: (bytes: number) => void,
): Promise<Hashes> {
  for (const dp of destPaths) {
    await fs.mkdir(path.dirname(dp), { recursive: true });
  }
  const hasher = await createRunningHash(withMd5);
  const writers = destPaths.map((p) => createWriteStream(p));
  const rs = createReadStream(src, { highWaterMark: 1 << 20 });
  try {
    for await (const chunk of rs) {
      if (state.canceled) throw new CanceledError();
      const buf = chunk as Buffer;
      hasher.update(buf);
      await Promise.all(writers.map((w) => writeChunk(w, buf)));
      onWork(buf.length * writers.length);
    }
  } catch (err) {
    rs.destroy();
    writers.forEach((w) => w.destroy());
    throw err;
  }
  await Promise.all(writers.map(endStream));
  return hasher.digest();
}

async function ensureFolders(dest: Destination): Promise<string> {
  const folder = destFolder(dest);
  await fs.mkdir(folder, { recursive: true });
  for (const sub of dest.subfolders) {
    await fs.mkdir(path.join(folder, sub), { recursive: true });
  }
  return folder;
}

export async function runCopy(spec: CopySpec): Promise<void> {
  const state: JobState = { canceled: false };
  jobs.set(spec.jobId, state);
  const startedAtMs = Date.now();

  const { source, destinations, verify, alsoMd5, writeMhl: doMhl } = spec;
  const destCount = destinations.length;
  const copyWork = source.totalBytes * destCount;
  const verifyWork = verify ? source.totalBytes * destCount : 0;
  const bytesTotal = copyWork + verifyWork || 1;

  let bytesDone = 0;
  let filesDone = 0;
  let lastEmit = 0;

  const emitJob = (phase: JobProgress['phase'], currentRelPath: string, force = false): void => {
    const now = Date.now();
    if (!force && now - lastEmit < 100) return;
    lastEmit = now;
    const elapsed = (now - startedAtMs) / 1000;
    const bytesPerSec = elapsed > 0 ? bytesDone / elapsed : 0;
    const etaSec = bytesPerSec > 0 ? (bytesTotal - bytesDone) / bytesPerSec : 0;
    emitter?.jobProgress({
      jobId: spec.jobId,
      bytesDone,
      bytesTotal,
      filesDone,
      filesTotal: source.files.length,
      bytesPerSec,
      etaSec,
      currentRelPath,
      phase,
    });
  };

  const emitFile = (
    index: number,
    file: SourceItem,
    status: FileStatus,
    fileFraction: number,
    error?: string,
  ): void => {
    emitter?.fileProgress({
      jobId: spec.jobId,
      fileIndex: index,
      relPath: file.relPath,
      status,
      fileFraction,
      error,
    });
  };

  // Per-destination collected MHL entries.
  const folders = await Promise.all(destinations.map(ensureFolders));
  const mhlEntries: MhlEntry[][] = destinations.map(() => []);
  const fileResults: FileResult[] = [];
  let verified = 0;
  let failed = 0;
  let canceled = false;

  for (let i = 0; i < source.files.length; i++) {
    const file = source.files[i];
    if (state.canceled) {
      canceled = true;
      break;
    }

    const destPaths = folders.map((f) => osPath(f, file.relPath));

    // Guard against overwriting the source itself.
    if (destPaths.some((dp) => path.resolve(dp) === path.resolve(file.path))) {
      fileResults.push({
        relPath: file.relPath,
        sizeBytes: file.sizeBytes,
        status: 'error',
        error: 'Ziel ist identisch mit der Quelle',
      });
      failed++;
      emitFile(i, file, 'error', 0, 'Ziel ist identisch mit der Quelle');
      continue;
    }

    const fileWork = file.sizeBytes * destCount * (verify ? 2 : 1) || 1;
    let fileWorkDone = 0;
    const bump = (bytes: number): void => {
      bytesDone += bytes;
      fileWorkDone += bytes;
      emitFile(i, file, 'copying', fileWorkDone / fileWork);
      emitJob('copy', file.relPath);
    };

    try {
      emitFile(i, file, 'copying', 0);
      const hashes = await copyAndHash(file.path, destPaths, alsoMd5, state, bump);

      let status: FileStatus = 'verified';
      if (verify) {
        emitFile(i, file, 'verifying', fileWorkDone / fileWork);
        for (const dp of destPaths) {
          const got = await hashFile(dp, alsoMd5, (n) => {
            bytesDone += n;
            fileWorkDone += n;
            emitJob('verify', file.relPath);
          });
          if (got.xxhash64 !== hashes.xxhash64) {
            status = 'mismatch';
            break;
          }
        }
      }

      // Record per-destination MHL entry.
      destinations.forEach((_d, di) => {
        mhlEntries[di].push({
          relPath: file.relPath,
          sizeBytes: file.sizeBytes,
          xxhash64: hashes.xxhash64,
          md5: hashes.md5,
          hashDate: new Date().toISOString(),
        });
      });

      fileResults.push({
        relPath: file.relPath,
        sizeBytes: file.sizeBytes,
        status,
        xxhash64: hashes.xxhash64,
        md5: hashes.md5,
        error: status === 'mismatch' ? 'Prüfsumme stimmt nicht überein' : undefined,
      });
      if (status === 'verified') verified++;
      else failed++;

      filesDone++;
      emitFile(i, file, status, 1, status === 'mismatch' ? 'Prüfsumme weicht ab' : undefined);
      emitJob('copy', file.relPath, true);
    } catch (err) {
      if (err instanceof CanceledError || state.canceled) {
        canceled = true;
        emitFile(i, file, 'canceled', fileWorkDone / fileWork);
        break;
      }
      const message = err instanceof Error ? err.message : String(err);
      fileResults.push({
        relPath: file.relPath,
        sizeBytes: file.sizeBytes,
        status: 'error',
        error: message,
      });
      failed++;
      emitFile(i, file, 'error', fileWorkDone / fileWork, message);
    }
  }

  // Write MHL sidecars (unless canceled before anything copied).
  const destResults = [];
  const finishISO = new Date().toISOString();
  for (let di = 0; di < destinations.length; di++) {
    const folder = folders[di];
    let mhlPath: string | undefined;
    if (doMhl && mhlEntries[di].length > 0) {
      emitJob('mhl', folder, true);
      try {
        mhlPath = await writeMhl(folder, mhlEntries[di], {
          startISO: new Date(startedAtMs).toISOString(),
          finishISO,
          tool: 'JM Copy 0.1.0',
        });
      } catch {
        mhlPath = undefined;
      }
    }
    destResults.push({ basePath: destinations[di].basePath, folder, mhlPath });
  }

  const finishedAtMs = Date.now();
  const result: JobResult = {
    jobId: spec.jobId,
    canceled,
    filesTotal: source.files.length,
    verified,
    failed,
    destinations: destResults,
    files: fileResults,
    startedAtMs,
    finishedAtMs,
    durationMs: finishedAtMs - startedAtMs,
    totalBytes: source.totalBytes,
  };
  jobs.delete(spec.jobId);
  emitter?.done(result);
}
