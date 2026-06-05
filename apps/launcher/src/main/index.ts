import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { registerIpc } from './ipc';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.mjs');

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
    registerIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
