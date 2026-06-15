import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { detectEncoders } from '@jm/media';
import type { MediaAsset } from '@shared/project';
import type {
  ExportRequest,
  ImportKind,
  PickOutputRequest,
  SaveProjectRequest,
  ThumbRequest,
} from '@shared/ipc-types';
import { importPaths } from './media';
import { grabFrame } from './ffmpeg/frame';
import { ensureProxy, setProxyEmitter } from './proxy/queue';
import { openProject, saveProject } from './project/io';
import { cancelExport, setExportEmitter, startExport } from './export/run';

const VIDEO_EXT = [
  'mp4', 'mov', 'mkv', 'avi', 'm4v', 'mxf', 'webm', 'mpg', 'mpeg',
  'wmv', 'flv', 'ts', 'm2ts', 'mts', '3gp', 'ogv', 'r3d',
];
const AUDIO_EXT = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'aif', 'aiff', 'wma'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'];

function filtersFor(kind: ImportKind): Electron.FileFilter[] {
  if (kind === 'audio') return [{ name: 'Audiodateien', extensions: AUDIO_EXT }];
  if (kind === 'image') return [{ name: 'Bilder', extensions: IMAGE_EXT }];
  return [{ name: 'Videodateien', extensions: VIDEO_EXT }];
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload);
  };

  setProxyEmitter({
    progress: (p) => send('proxy:progress', p),
    done: (r) => send('proxy:done', r),
  });
  setExportEmitter({
    progress: (p) => send('export:progress', p),
    done: (r) => send('export:done', r),
  });

  ipcMain.handle('dialog:importMedia', async (_e, kind: ImportKind) => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [...filtersFor(kind), { name: 'Alle Dateien', extensions: ['*'] }],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('media:import', (_e, paths: string[]) => importPaths(paths));
  ipcMain.handle('media:thumb', (_e, req: ThumbRequest) => grabFrame(req));

  ipcMain.handle('proxy:ensure', (_e, asset: MediaAsset) => ensureProxy(asset));

  ipcMain.handle('project:open', () => openProject(getWindow()));
  ipcMain.handle('project:save', (_e, req: SaveProjectRequest) => saveProject(getWindow(), req));

  ipcMain.handle('export:pickOutput', async (_e, req: PickOutputRequest) => {
    const win = getWindow();
    const options: Electron.SaveDialogOptions = {
      defaultPath: `${req.defaultName}.${req.ext}`,
      filters: [{ name: req.ext.toUpperCase(), extensions: [req.ext] }],
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : result.filePath;
  });

  ipcMain.handle('export:start', (_e, req: ExportRequest) => startExport(req));
  ipcMain.handle('export:cancel', (_e, id: string) => cancelExport(id));

  ipcMain.handle('encoders:get', () => detectEncoders());

  ipcMain.handle('shell:reveal', (_e, p: string) => shell.showItemInFolder(p));
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}
