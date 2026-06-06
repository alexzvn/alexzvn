import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import type { AppEvent } from '@shared/types';
import { registerIpc } from './ipc';
import { initManifest, refreshManifest } from './manifest';
import { initAutoUpdate } from './updater';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.mjs');

function emitAppEvent(event: AppEvent): void {
  getMainWindow()?.webContents.send('app:event', event);
}

function createWindow(): BrowserWindow {
  return createMainWindow({
    title: 'JM Production Suite',
    preloadPath,
    iconPath: resourcePath('icon.png', join(__dirname, '..', '..', 'resources')),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
  });
}

if (setupSingleInstance(() => createWindow())) {
  app.whenReady().then(() => {
    initManifest(); // lokalen Manifest-Cache laden, bevor das Fenster Tools abfragt
    registerIpc();
    createWindow();

    // Hintergrund: remote suite.json holen + Self-Update prüfen (nur gepackt)
    refreshManifest()
      .then((changed) => {
        if (changed) emitAppEvent({ type: 'manifest-changed' });
      })
      .catch(() => {});
    initAutoUpdate(emitAppEvent);
    // Launcher-Self-Update läuft jetzt über den Renderer (loadLauncherUpdate →
    // Banner mit „Aktualisieren"), siehe updates.ts/installer.ts.

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
