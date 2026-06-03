import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { basename, extname, join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import type { PickedImage, SaveImageRequest, SaveImageResult } from '@shared/types';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff'];

async function readPicked(filePath: string): Promise<PickedImage> {
  const buf = await readFile(filePath);
  return {
    path: filePath,
    fileName: basename(filePath),
    bytes: new Uint8Array(buf),
  };
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
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

  ipcMain.handle('shell:reveal', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url));

  // Avoid an unused-import lint on join until project I/O lands in Phase 2.
  void join;
}
