import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type {
  OfficeConvertSpec,
  VideoConvertSpec,
} from '@shared/types';
import { probeMedia } from './ffmpeg/probe';
import { detectEncoders } from './ffmpeg/encoders';
import { cancelVideo, enqueueVideo, setVideoEmitter } from './ffmpeg/convert';
import { enqueueOffice, setOfficeEmitter } from './office/convert';
import { locateSoffice } from './office/locate';

const VIDEO_EXT = [
  'mp4', 'mov', 'mkv', 'avi', 'm4v', 'mxf', 'webm', 'mpg', 'mpeg',
  'wmv', 'flv', 'ts', 'm2ts', 'mts', '3gp', 'ogv',
];
const OFFICE_EXT = [
  'doc', 'docx', 'odt', 'rtf', 'txt',
  'xls', 'xlsx', 'ods', 'csv',
  'ppt', 'pptx', 'odp',
];

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload);
  };

  setVideoEmitter({
    progress: (p) => send('job:progress', p),
    done: (r) => send('job:done', r),
  });
  setOfficeEmitter({
    progress: (p) => send('job:progress', p),
    done: (r) => send('job:done', r),
  });

  ipcMain.handle('dialog:pickFiles', async (_event, kind: 'video' | 'office') => {
    const win = getWindow();
    const filters =
      kind === 'video'
        ? [{ name: 'Videodateien', extensions: VIDEO_EXT }]
        : [{ name: 'Office-Dokumente', extensions: OFFICE_EXT }];
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [...filters, { name: 'Alle Dateien', extensions: ['*'] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:pickDir', async () => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('media:probe', (_event, filePath: string) => probeMedia(filePath));

  ipcMain.handle('encoders:get', () => detectEncoders());

  ipcMain.handle('video:enqueue', (_event, spec: VideoConvertSpec) => {
    enqueueVideo(spec);
  });
  ipcMain.handle('video:cancel', (_event, jobId: string) => {
    cancelVideo(jobId);
  });

  ipcMain.handle('office:detect', async () => ({ path: await locateSoffice() }));
  ipcMain.handle('office:enqueue', (_event, spec: OfficeConvertSpec) => {
    enqueueOffice(spec);
  });

  ipcMain.handle('shell:reveal', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url));
}
