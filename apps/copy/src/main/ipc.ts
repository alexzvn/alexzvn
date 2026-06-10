import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type { CopySpec, JobResult, SyncJob } from '@shared/types';
import { scanPaths } from './copy/scan';
import { runCopy, cancelCopy, setCopyEmitter } from './copy/engine';
import { findMhl, runVerify } from './copy/verify';
import { buildPreview, cancelSync, runSync, setSyncEmitter } from './sync/engine';
import * as syncStore from './sync/store';

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload);
  };

  setCopyEmitter({
    fileProgress: (p) => send('copy:fileProgress', p),
    jobProgress: (p) => send('copy:jobProgress', p),
    done: (r) => send('copy:done', r),
  });

  setSyncEmitter({
    progress: (p) => send('sync:progress', p),
    done: (r) => send('sync:done', r),
  });

  ipcMain.handle('dialog:pickDir', async (_event, title?: string) => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      title,
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:pickFiles', async () => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'openDirectory', 'multiSelections'],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('scan:paths', async (_event, paths: string[]) => {
    return scanPaths(paths);
  });

  ipcMain.handle('copy:start', async (_event, spec: CopySpec) => {
    // Run detached; progress + completion arrive via events.
    runCopy(spec).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const now = Date.now();
      const result: JobResult = {
        jobId: spec.jobId,
        canceled: false,
        filesTotal: spec.source.files.length,
        verified: 0,
        failed: spec.source.files.length,
        destinations: [],
        files: [],
        startedAtMs: now,
        finishedAtMs: now,
        durationMs: 0,
        totalBytes: spec.source.totalBytes,
      };
      send('copy:fileProgress', {
        jobId: spec.jobId,
        fileIndex: -1,
        relPath: '',
        status: 'error',
        fileFraction: 0,
        error: message,
      });
      send('copy:done', result);
    });
  });

  ipcMain.handle('copy:cancel', async (_event, jobId: string) => {
    cancelCopy(jobId);
  });

  ipcMain.handle('verify:findMhl', async (_event, dir: string) => {
    return findMhl(dir);
  });

  ipcMain.handle('verify:run', async (_event, mhlPath: string) => {
    return runVerify(mhlPath, (p) => send('verify:progress', p));
  });

  // ---- Netzwerk-Sync ----
  ipcMain.handle('sync:listJobs', async () => syncStore.listJobs());
  ipcMain.handle('sync:saveJob', async (_event, job: SyncJob) => syncStore.saveJob(job));
  ipcMain.handle('sync:removeJob', async (_event, id: string) => {
    syncStore.removeJob(id);
  });
  ipcMain.handle('sync:preview', async (_event, id: string) => {
    const job = syncStore.getJob(id);
    if (!job) throw new Error('Sync-Job nicht gefunden.');
    return buildPreview(job);
  });
  ipcMain.handle('sync:run', async (_event, id: string) => {
    const job = syncStore.getJob(id);
    if (!job) throw new Error('Sync-Job nicht gefunden.');
    // Detached; Fortschritt/Abschluss kommen über Events.
    runSync(job).catch((err: unknown) => {
      const now = Date.now();
      send('sync:done', {
        jobId: id,
        at: now,
        copied: 0,
        deleted: 0,
        failed: 1,
        bytes: 0,
        durationMs: 0,
        canceled: false,
        targets: [
          {
            targetId: '',
            targetPath: '',
            copied: 0,
            deleted: 0,
            failed: 1,
            error: err instanceof Error ? err.message : String(err),
          },
        ],
      });
    });
  });
  ipcMain.handle('sync:cancel', async (_event, id: string) => {
    cancelSync(id);
  });

  ipcMain.handle('shell:reveal', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
