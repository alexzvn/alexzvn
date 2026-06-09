import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { VerifyFile, VerifyProgress, VerifyReport } from '@shared/types';
import { readMhl } from './mhl';
import { hashFile } from './hash';

/** List .mhl sidecars directly inside a folder. */
export async function findMhl(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.mhl'))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

/** Re-verify every file referenced by an MHL against its recorded hash. */
export async function runVerify(
  mhlPath: string,
  onProgress: (p: VerifyProgress) => void,
): Promise<VerifyReport> {
  const { root, entries } = await readMhl(mhlPath);
  const files: VerifyFile[] = [];
  let ok = 0;
  let mismatch = 0;
  let missing = 0;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    onProgress({ done: i, total: entries.length, currentRelPath: e.relPath });

    const full = path.join(root, ...e.relPath.split('/'));
    let size: number;
    try {
      size = (await fs.stat(full)).size;
    } catch {
      missing++;
      files.push({ relPath: e.relPath, status: 'missing', expected: e.xxhash64 ?? e.md5 });
      continue;
    }

    const useMd5 = !e.xxhash64 && !!e.md5;
    const got = await hashFile(full, useMd5);
    const actual = e.xxhash64 ? got.xxhash64 : got.md5;
    const expected = e.xxhash64 ?? e.md5;

    if (actual && actual === expected) {
      ok++;
      files.push({ relPath: e.relPath, status: 'ok', expected, actual, sizeBytes: size });
    } else {
      mismatch++;
      files.push({ relPath: e.relPath, status: 'mismatch', expected, actual, sizeBytes: size });
    }
  }

  onProgress({ done: entries.length, total: entries.length, currentRelPath: '' });
  return { mhlPath, root, total: entries.length, ok, mismatch, missing, files };
}
