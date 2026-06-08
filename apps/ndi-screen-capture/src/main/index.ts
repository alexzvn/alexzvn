import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { registerIpc } from './ipc';
import { installDisplayMediaHandler } from './capture-handler';

declare const __dirname: string;

// Windows: Das neue Windows-Graphics-Capture-Backend (WGC) scheitert auf manchen
// Systemen (Hybrid-GPU/Treiber/Sitzung) mit E_FAIL/E_INVALIDARG → die Aufnahme
// liefert keine Frames und Bild (Vorschau + NDI) bleibt schwarz. Wir schalten WGC
// ab (Chromium fällt auf DXGI/GDI zurück) und deaktivieren zusätzlich die GPU-
// Beschleunigung, damit der robuste Software-Desktop-Capturer greift. Die WGC-
// Feature-Namen variieren je Chromium-Version → alle bekannten Varianten setzen.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch(
    'disable-features',
    [
      'WebRtcAllowWgcScreenCapturer',
      'WebRtcAllowWgcWindowCapturer',
      'WebRtcAllowWgcDesktopCapturer',
      'AllowWgcScreenCapturer',
      'AllowWgcWindowCapturer',
    ].join(','),
  );
  app.disableHardwareAcceleration();
}

const preloadPath = join(__dirname, '../preload/index.mjs');

function createWindow(): BrowserWindow {
  const win = createMainWindow({
    title: 'JM NDI Screen Capture',
    preloadPath,
    iconPath: resourcePath('icon.png', join(__dirname, '..', '..', 'resources')),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
  });

  // Renderer-Konsole (nur unsere [jmndi]-Logs) ins Terminal spiegeln, damit man
  // zum Debuggen keine DevTools öffnen muss.
  win.webContents.on('console-message', (_e, _level, message) => {
    if (message.includes('[jmndi]')) console.log('[renderer]', message);
  });

  return win;
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
