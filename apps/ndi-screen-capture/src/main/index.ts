import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { registerIpc } from './ipc';
import { installDisplayMediaHandler } from './capture-handler';

declare const __dirname: string;

// Windows: Das neue Windows-Graphics-Capture-Backend (WGC) scheitert auf manchen
// Systemen (Hybrid-GPU/Treiber/Sitzung) mit E_FAIL/E_INVALIDARG → die Aufnahme
// liefert keine Frames und Bild (Vorschau + NDI) bleibt schwarz. Wir schalten WGC
// ab; Chromium fällt dann auf den klassischen Desktop-Capturer (DirectX/GDI)
// zurück, der hier zuverlässig liefert.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'AllowWgcScreenCapturer,AllowWgcWindowCapturer');
}

const preloadPath = join(__dirname, '../preload/index.mjs');

function createWindow(): BrowserWindow {
  return createMainWindow({
    title: 'JM NDI Screen Capture',
    preloadPath,
    iconPath: resourcePath('icon.png', join(__dirname, '..', '..', 'resources')),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
  });
}

if (setupSingleInstance(() => createWindow())) {
  app.whenReady().then(() => {
    installDisplayMediaHandler();
    registerIpc(() => getMainWindow());
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
