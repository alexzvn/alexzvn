import { app, ipcMain } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import type { LibraryAddRequest, LibraryItem } from '@shared/types';

/** On-disk record (the data-url thumbnail is rebuilt on list, not stored). */
interface StoredItem {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

function libDir(): string {
  return path.join(app.getPath('userData'), 'library');
}
function indexPath(): string {
  return path.join(libDir(), 'index.json');
}
function assetPath(id: string): string {
  return path.join(libDir(), `${id}.png`);
}
function thumbPath(id: string): string {
  return path.join(libDir(), `${id}.thumb.png`);
}

async function ensureDir(): Promise<void> {
  if (!existsSync(libDir())) await mkdir(libDir(), { recursive: true });
}

async function readIndex(): Promise<StoredItem[]> {
  try {
    return JSON.parse(await readFile(indexPath(), 'utf8')) as StoredItem[];
  } catch {
    return [];
  }
}

async function writeIndex(items: StoredItem[]): Promise<void> {
  await writeFile(indexPath(), JSON.stringify(items, null, 2));
}

async function toItem(s: StoredItem): Promise<LibraryItem> {
  let thumbDataUrl = '';
  try {
    const buf = await readFile(thumbPath(s.id));
    thumbDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    /* missing thumb */
  }
  return { ...s, thumbDataUrl };
}

export function registerLibraryIpc(): void {
  ipcMain.handle('library:list', async (): Promise<LibraryItem[]> => {
    const items = await readIndex();
    items.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(items.map(toItem));
  });

  ipcMain.handle('library:add', async (_e, req: LibraryAddRequest): Promise<LibraryItem> => {
    await ensureDir();
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    await writeFile(assetPath(id), Buffer.from(req.pngBytes));
    await writeFile(thumbPath(id), Buffer.from(req.thumbBytes));
    const stored: StoredItem = {
      id,
      name: req.name,
      width: req.width,
      height: req.height,
      createdAt: Date.now(),
    };
    const items = await readIndex();
    items.push(stored);
    await writeIndex(items);
    return toItem(stored);
  });

  ipcMain.handle('library:remove', async (_e, id: string): Promise<void> => {
    const items = (await readIndex()).filter((i) => i.id !== id);
    await writeIndex(items);
    for (const p of [assetPath(id), thumbPath(id)]) {
      try {
        await unlink(p);
      } catch {
        /* already gone */
      }
    }
  });

  ipcMain.handle('library:read', async (_e, id: string): Promise<Uint8Array | null> => {
    try {
      return new Uint8Array(await readFile(assetPath(id)));
    } catch {
      return null;
    }
  });
}
