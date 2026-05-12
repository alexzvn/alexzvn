import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import { join } from 'node:path';
import { loadState } from './state';
import {
  startServer,
  SERVER_HOST,
  SERVER_PORT,
  getRemoteUrls,
  getLanAddresses,
} from './server';

// __dirname is a CJS built-in, available because vite builds main as CommonJS.
declare const __dirname: string;

type ViewName = 'operator' | 'speaker';

let operatorWindow: BrowserWindow | null = null;
let speakerWindow: BrowserWindow | null = null;

const preloadPath = join(__dirname, '../preload/index.mjs');

function loadView(win: BrowserWindow, view: ViewName): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    win.loadURL(`${rendererUrl}/?view=${view}`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      search: `view=${view}`,
    });
  }
}

function createOperatorWindow(): void {
  if (operatorWindow) {
    operatorWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Timer · Operator',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    operatorWindow = null;
  });

  loadView(win, 'operator');
  operatorWindow = win;
}

function openSpeakerWindow(): void {
  if (speakerWindow) {
    if (speakerWindow.isMinimized()) speakerWindow.restore();
    speakerWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const secondary = displays.find((d) => d.id !== primary.id) ?? primary;
  const { x, y, width, height } = secondary.workArea;

  const win = new BrowserWindow({
    x,
    y,
    width: Math.min(width, 1600),
    height: Math.min(height, 900),
    backgroundColor: '#121212',
    show: false,
    autoHideMenuBar: true,
    title: 'JM Timer · Speaker',
    fullscreenable: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
    // Only auto-fullscreen on the secondary display — avoid hijacking primary monitor
    if (secondary.id !== primary.id) {
      win.setFullScreen(true);
    }
  });

  win.on('closed', () => {
    speakerWindow = null;
    operatorWindow?.webContents.send('speaker:status', false);
  });

  loadView(win, 'speaker');
  speakerWindow = win;
  operatorWindow?.webContents.send('speaker:status', true);
}

function closeSpeakerWindow(): void {
  speakerWindow?.close();
}

function registerIpc(): void {
  ipcMain.handle('speaker:open', () => openSpeakerWindow());
  ipcMain.handle('speaker:close', () => closeSpeakerWindow());
  ipcMain.handle('speaker:toggle', () => {
    if (speakerWindow) closeSpeakerWindow();
    else openSpeakerWindow();
  });
  ipcMain.handle('speaker:isOpen', () => speakerWindow !== null);
  ipcMain.handle('speaker:fullscreen', (_event, flag: boolean) => {
    if (!speakerWindow) return false;
    speakerWindow.setFullScreen(flag);
    return flag;
  });
  ipcMain.handle('speaker:isFullscreen', () => {
    return speakerWindow?.isFullScreen() ?? false;
  });
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle('remote:getUrls', () => getRemoteUrls());
  ipcMain.handle('remote:getAddresses', () => getLanAddresses());
}

app.whenReady().then(async () => {
  loadState();
  await startServer();
  registerIpc();
  createOperatorWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOperatorWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

export { SERVER_HOST, SERVER_PORT };
