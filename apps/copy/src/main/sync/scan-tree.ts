import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Junk-Dateien, die nie synchronisiert werden. */
const JUNK = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

export interface TreeEntry {
  /** Absoluter Pfad. */
  path: string;
  /** Pfad relativ zum Scan-Root (POSIX, Root selbst nicht enthalten). */
  relPath: string;
  sizeBytes: number;
  mtimeMs: number;
}

export interface Tree {
  root: string;
  /** relPath → Eintrag. */
  entries: Map<string, TreeEntry>;
  totalBytes: number;
  /** Verzeichnisse, die nicht gelesen werden konnten. */
  skipped: string[];
}

async function walk(root: string, dir: string, tree: Tree): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    tree.skipped.push(dir);
    return;
  }
  for (const entry of entries) {
    if (JUNK.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, tree);
    } else if (entry.isFile()) {
      try {
        const st = await fs.stat(full);
        const relPath = path.relative(root, full).split(path.sep).join('/');
        tree.entries.set(relPath, {
          path: full,
          relPath,
          sizeBytes: st.size,
          mtimeMs: st.mtimeMs,
        });
        tree.totalBytes += st.size;
      } catch {
        tree.skipped.push(full);
      }
    }
  }
}

/**
 * Enumeriert alle Dateien UNTER `root` (Root selbst nicht im relPath). Liefert
 * eine leere Map, wenn `root` nicht existiert/lesbar ist (Aufrufer entscheidet,
 * ob das ein Fehler ist). relPaths sind POSIX, damit sie über Plattformen hinweg
 * vergleichbar sind.
 */
export async function scanTree(root: string): Promise<Tree> {
  const tree: Tree = { root, entries: new Map(), totalBytes: 0, skipped: [] };
  await walk(root, root, tree);
  return tree;
}
