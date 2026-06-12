import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ScanResult, SourceItem } from '@shared/types';

/** Junk files we never want to carry into a clean master folder. */
const JUNK = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

interface RawFile {
  path: string;
  sizeBytes: number;
}

async function walk(dir: string, out: RawFile[], skipped: string[]): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    skipped.push(dir);
    return;
  }
  for (const entry of entries) {
    if (JUNK.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out, skipped);
    } else if (entry.isFile()) {
      try {
        const st = await fs.stat(full);
        out.push({ path: full, sizeBytes: st.size });
      } catch {
        skipped.push(full);
      }
    }
  }
}

/** Longest common directory prefix of the given absolute paths. */
function commonDir(dirs: string[]): string {
  if (dirs.length === 0) return path.sep;
  if (dirs.length === 1) return dirs[0];
  const split = dirs.map((d) => d.split(path.sep));
  const first = split[0];
  let i = 0;
  for (; i < first.length; i++) {
    if (!split.every((parts) => parts[i] === first[i])) break;
  }
  const prefix = first.slice(0, i).join(path.sep);
  return prefix || path.sep;
}

/**
 * Enumerate every file under the selected files/folders into one ScanResult.
 *
 * Root selection (drives the relPath each file keeps in the master folder):
 *  - A SINGLE selected folder is treated as "copy its contents" — the folder
 *    itself becomes the root, so its children (Footage, Audio, …) land directly
 *    in the master and the folder's own name is NOT repeated under it (#25).
 *  - Multiple inputs (or single files) use their common parent as root, so the
 *    names of the dropped folders/files stay as structure and never collide.
 */
export async function scanPaths(inputs: string[]): Promise<ScanResult> {
  const files: RawFile[] = [];
  const skipped: string[] = [];
  let singleDirInput = false;

  for (const input of inputs) {
    let st: import('node:fs').Stats;
    try {
      st = await fs.stat(input);
    } catch {
      skipped.push(input);
      continue;
    }
    if (st.isDirectory()) {
      if (inputs.length === 1) singleDirInput = true;
      await walk(input, files, skipped);
    } else if (st.isFile()) {
      if (!JUNK.has(path.basename(input))) {
        files.push({ path: input, sizeBytes: st.size });
      }
    }
  }

  const root = singleDirInput ? inputs[0] : commonDir(inputs.map((p) => path.dirname(p)));
  const items: SourceItem[] = files.map((f) => ({
    path: f.path,
    relPath: path.relative(root, f.path).split(path.sep).join('/'),
    sizeBytes: f.sizeBytes,
  }));
  items.sort((a, b) => a.relPath.localeCompare(b.relPath));

  return {
    root,
    files: items,
    totalBytes: items.reduce((sum, f) => sum + f.sizeBytes, 0),
    skipped,
  };
}
