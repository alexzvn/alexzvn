import { app, BrowserWindow } from 'electron';
import { registerIpc } from './ipc';
import { createEditorWindow } from './windows';

// Single-instance lock — a second launch focuses the existing editor window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else {
      createEditorWindow();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    createEditorWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createEditorWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
