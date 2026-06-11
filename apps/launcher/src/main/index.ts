import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import type { AppEvent } from '@shared/types';
import { registerIpc } from './ipc';
import { initManifest, refreshManifest } from './manifest';
import { initChangelog, refreshChangelog } from './changelog';

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
    initChangelog(); // dito für die App-Patchnotes
    registerIpc();
    createWindow();

    // Hintergrund: remote suite.json holen
    refreshManifest()
      .then((changed) => {
        if (changed) emitAppEvent({ type: 'manifest-changed' });
      })
      .catch(() => {});
    // … und die remote changelog.json (App-Patchnotes ohne Launcher-Release).
    refreshChangelog()
      .then((changed) => {
        if (changed) emitAppEvent({ type: 'changelog-changed' });
      })
      .catch(() => {});
    // Launcher-Self-Update läuft über den Renderer (loadLauncherUpdate → Banner
    // mit „Aktualisieren"), siehe updates.ts/installer.ts. Den früheren
    // electron-updater-Pfad gibt es nicht mehr: er konnte mangels Feed (private
    // Releases via Proxy/Token) nur fehlschlagen und blendete dabei beim Start
    // eine nicht-handlungsrelevante Fehler-Notice ein (Issue #8).

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
