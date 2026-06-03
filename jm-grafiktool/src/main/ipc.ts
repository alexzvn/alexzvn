import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { basename, extname } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import type {
  OpenedFile,
  OpenKind,
  PickedImage,
  SaveBytesRequest,
  SaveImageRequest,
  SaveImageResult,
} from '@shared/types';
import { registerAiIpc } from './ai';
import { registerLibraryIpc } from './library';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff'];
const OPEN_EXT = [...IMAGE_EXT, 'psd', 'svg', 'jmg'];

async function readPicked(filePath: string): Promise<PickedImage> {
  const buf = await readFile(filePath);
  return {
    path: filePath,
    fileName: basename(filePath),
    bytes: new Uint8Array(buf),
  };
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  registerAiIpc();
  registerLibraryIpc();

  ipcMain.handle('dialog:pickImages', async (): Promise<PickedImage[]> => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Bilder', extensions: IMAGE_EXT },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    return Promise.all(result.filePaths.map(readPicked));
  });

  ipcMain.handle('file:read', (_event, filePath: string) => readPicked(filePath));

  ipcMain.handle(
    'file:saveImage',
    async (_event, req: SaveImageRequest): Promise<SaveImageResult> => {
      const win = getWindow();
      const ext = req.format === 'jpg' ? 'jpg' : req.format;
      const options: Electron.SaveDialogOptions = {
        defaultPath: `${req.suggestedName}.${ext}`,
        filters: [{ name: req.format.toUpperCase(), extensions: [ext] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return { saved: false };
      let target = result.filePath;
      if (!extname(target)) target = `${target}.${ext}`;
      await writeFile(target, Buffer.from(req.bytes));
      return { saved: true, path: target };
    },
  );

  ipcMain.handle('file:open', async (_event, kind: OpenKind): Promise<OpenedFile | null> => {
    const win = getWindow();
    const filters: Electron.FileFilter[] =
      kind === 'project'
        ? [{ name: 'JM Grafik-Projekt', extensions: ['jmg'] }]
        : [
            { name: 'Grafik & Bilder', extensions: OPEN_EXT },
            { name: 'Photoshop', extensions: ['psd'] },
            { name: 'JM Grafik-Projekt', extensions: ['jmg'] },
            { name: 'Alle Dateien', extensions: ['*'] },
          ];
    const options: Electron.OpenDialogOptions = { properties: ['openFile'], filters };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    return readPicked(result.filePaths[0]);
  });

  ipcMain.handle(
    'file:saveBytes',
    async (_event, req: SaveBytesRequest): Promise<SaveImageResult> => {
      const win = getWindow();
      const options: Electron.SaveDialogOptions = {
        defaultPath: `${req.suggestedName}.${req.ext}`,
        filters: [{ name: req.filterName, extensions: [req.ext] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return { saved: false };
      let target = result.filePath;
      if (!extname(target)) target = `${target}.${req.ext}`;
      await writeFile(target, Buffer.from(req.bytes));
      return { saved: true, path: target };
    },
  );

  ipcMain.handle('fonts:list', async (): Promise<string[]> => {
    try {
      const mod = (await import('font-list')) as unknown as {
        getFonts?: (o?: { disableQuoting?: boolean }) => Promise<string[]>;
        default?: { getFonts?: (o?: { disableQuoting?: boolean }) => Promise<string[]> };
      };
      const getFonts = mod.getFonts ?? mod.default?.getFonts;
      if (!getFonts) return [];
      const fonts = await getFonts({ disableQuoting: true });
      return Array.from(
        new Set(fonts.map((f) => f.replace(/^"|"$/g, '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  });

  ipcMain.handle('shell:reveal', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url));
}
