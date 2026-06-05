import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { scanPaths } from './scan';
import { runCopy, setCopyEmitter } from './engine';
import { runVerify, findMhl } from './verify';
import type { CopySpec, JobResult } from '@shared/types';

let work: string;
let src: string;
let destA: string;
let destB: string;

beforeEach(async () => {
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'jm-copy-it-'));
  src = path.join(work, 'CARD');
  destA = path.join(work, 'destA');
  destB = path.join(work, 'destB');
  await fs.mkdir(path.join(src, 'A001'), { recursive: true });
  await fs.writeFile(path.join(src, 'A001', 'clip01.mov'), randomBytes(200_000));
  await fs.writeFile(path.join(src, 'A001', 'clip02.mov'), randomBytes(50_000));
  await fs.writeFile(path.join(src, 'notes.txt'), 'hello');
});

afterEach(async () => {
  await fs.rm(work, { recursive: true, force: true });
});

function runJob(spec: CopySpec): Promise<JobResult> {
  return new Promise((resolve) => {
    setCopyEmitter({ fileProgress() {}, jobProgress() {}, done: (r) => resolve(r) });
    void runCopy(spec);
  });
}

describe('runCopy (integration)', () => {
  it('copies to multiple destinations, verifies, and writes MHL', async () => {
    const source = await scanPaths([src]);
    expect(source.files).toHaveLength(3);

    const spec: CopySpec = {
      jobId: 'job1',
      source,
      destinations: [
        { id: 'a', basePath: destA, subPath: '2026-06-05_Test', subfolders: ['Footage'] },
        { id: 'b', basePath: destB, subPath: '2026-06-05_Test', subfolders: ['Footage'] },
      ],
      verify: true,
      alsoMd5: false,
      writeMhl: true,
    };

    const result = await runJob(spec);

    expect(result.verified).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.canceled).toBe(false);

    // Files landed in both destinations under the master folder + preserved structure.
    const copied = path.join(destA, '2026-06-05_Test', 'CARD', 'A001', 'clip01.mov');
    expect((await fs.stat(copied)).size).toBe(200_000);
    // Fixed subfolder created.
    expect((await fs.stat(path.join(destA, '2026-06-05_Test', 'Footage'))).isDirectory()).toBe(true);

    // MHL written into each destination.
    const folderA = path.join(destA, '2026-06-05_Test');
    const mhls = await findMhl(folderA);
    expect(mhls).toHaveLength(1);

    // Re-verify is clean.
    const report = await runVerify(mhls[0], () => {});
    expect(report.ok).toBe(3);
    expect(report.mismatch).toBe(0);
    expect(report.missing).toBe(0);
  });

  it('detects a corrupted file on re-verify', async () => {
    const source = await scanPaths([src]);
    const spec: CopySpec = {
      jobId: 'job2',
      source,
      destinations: [{ id: 'a', basePath: destA, subPath: 'master', subfolders: [] }],
      verify: true,
      alsoMd5: false,
      writeMhl: true,
    };
    await runJob(spec);

    const folder = path.join(destA, 'master');
    const [mhl] = await findMhl(folder);

    // Tamper with one copied file after the MHL was written.
    await fs.writeFile(path.join(folder, 'CARD', 'notes.txt'), 'tampered');
    // And remove another.
    await fs.rm(path.join(folder, 'CARD', 'A001', 'clip02.mov'));

    const report = await runVerify(mhl, () => {});
    expect(report.mismatch).toBe(1);
    expect(report.missing).toBe(1);
    expect(report.ok).toBe(1);
  });
});
