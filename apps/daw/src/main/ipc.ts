import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type { MediaAsset } from '@shared/project';
import type {
  ArmInput,
  ExportRunRequest,
  PickOutputRequest,
  SaveProjectRequest,
  StartRecordInput,
} from '@shared/ipc-types';
import { importPaths, transcodeForDecode } from './media';
import { openProject, saveProject } from './project/io';
import { cancelExport, setExportEmitter, startExport } from './export/run';
import * as rec from './recording';

const AUDIO_EXT = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'aif', 'aiff', 'wma'];

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload);
  };

  setExportEmitter({
    progress: (p) => send('export:progress', p),
    done: (r) => send('export:done', r),
  });
  rec.setWindowGetter(getWindow);

  // ── Medien-Import ──────────────────────────────────────────────────────────
  ipcMain.handle('dialog:importAudio', async () => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audiodateien', extensions: AUDIO_EXT },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('media:import', (_e, paths: string[]) => importPaths(paths));
  ipcMain.handle('media:transcodeForDecode', (_e, asset: MediaAsset) => transcodeForDecode(asset));

  // ── Projekt ────────────────────────────────────────────────────────────────
  ipcMain.handle('project:open', () => openProject(getWindow()));
  ipcMain.handle('project:save', (_e, req: SaveProjectRequest) => saveProject(getWindow(), req));

  // ── Export ───────────────────────────────────────────────────────────────
  ipcMain.handle('export:pickOutput', async (_e, req: PickOutputRequest) => {
    const win = getWindow();
    const options: Electron.SaveDialogOptions = {
      defaultPath: `${req.defaultName}.${req.ext}`,
      filters: [{ name: req.ext.toUpperCase(), extensions: [req.ext] }],
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : result.filePath;
  });

  ipcMain.handle('export:start', (_e, req: ExportRunRequest) => startExport(req));
  ipcMain.handle('export:cancel', (_e, id: string) => cancelExport(id));

  // ── Aufnahme ──────────────────────────────────────────────────────────────
  ipcMain.handle('rec:listDevices', () => rec.listDevices());
  ipcMain.handle('rec:arm', (_e, input: ArmInput) => rec.arm(input));
  ipcMain.handle('rec:disarm', () => rec.disarm());
  ipcMain.handle('rec:start', (_e, input: StartRecordInput) => rec.startRecording(input));
  ipcMain.handle('rec:stop', () => rec.stopRecording());
  ipcMain.handle('rec:state', () => rec.getState());

  // ── Shell ───────────────────────────────────────────────────────────────
  ipcMain.handle('shell:reveal', (_e, p: string) => shell.showItemInFolder(p));
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}
