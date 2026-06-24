import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { whisperAvailable } from './locate';
import { enqueueUtterance, initTranscriber, stopTranscriber } from './transcriber';
import type { CaptionConfig, CaptionLine, CaptionState } from '@shared/types';

declare const __dirname: string;

const MAX_LINES = 40;
const preloadPath = join(__dirname, '../preload/index.mjs');
let mainWindow: BrowserWindow | null = null;

const defaultConfig: CaptionConfig = {
  model: 'base',
  language: 'de',
  maxUtteranceSec: 8,
  silenceMs: 700,
  silenceThreshold: 0.012,
};

let config: CaptionConfig = { ...defaultConfig };
let running = false;
let hold = false;
let busy = false;
let error: string | null = null;
let lines: CaptionLine[] = [];
let lineSeq = 0;

function configPath(): string {
  return join(app.getPath('userData'), 'caption.config.json');
}
function loadConfig(): void {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<CaptionConfig>;
    config = { ...defaultConfig, ...raw };
  } catch {
    config = { ...defaultConfig };
  }
}
function saveConfig(): void {
  try {
    writeFileSync(configPath(), JSON.stringify(config, null, 2));
  } catch {
    /* best-effort */
  }
}

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function buildState(): CaptionState {
  return { running, hold, busy, whisperAvailable: whisperAvailable(), lines, config, error };
}
function broadcast(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('caption:state', buildState());
}

initTranscriber({
  config: () => config,
  onText: (text) => {
    lines = [...lines, { id: `l${Date.now()}_${lineSeq++}`, text, at: Date.now() }].slice(-MAX_LINES);
    broadcast();
  },
  onBusy: (b) => {
    busy = b;
    broadcast();
  },
  onError: (msg) => {
    if (msg !== error) {
      error = msg;
      if (msg) getLog().warn(`Caption: ${msg}`);
      broadcast();
    }
  },
});

function registerIpc(): void {
  ipcMain.handle('caption:getState', () => buildState());
  ipcMain.handle('caption:setConfig', (_e, patch: Partial<CaptionConfig>) => {
    config = { ...config, ...patch };
    saveConfig();
    broadcast();
    return buildState();
  });
  ipcMain.handle('caption:start', () => {
    running = true;
    error = null;
    broadcast();
    return buildState();
  });
  ipcMain.handle('caption:stop', () => {
    running = false;
    stopTranscriber();
    broadcast();
    return buildState();
  });
  ipcMain.handle('caption:setHold', (_e, h: boolean) => {
    hold = h;
    broadcast();
    return buildState();
  });
  ipcMain.handle('caption:clear', () => {
    lines = [];
    broadcast();
    return buildState();
  });
  ipcMain.handle('caption:correctLast', (_e, text: string) => {
    if (lines.length) {
      const last = lines[lines.length - 1];
      lines = [...lines.slice(0, -1), { ...last, text }];
      broadcast();
    }
    return buildState();
  });
  // Fire-and-forget: erkannte Äußerung vom Renderer → Transkriptions-Queue.
  ipcMain.on('caption:utterance', (_e, pcm: Float32Array, sampleRate: number) => {
    if (running) enqueueUtterance(pcm instanceof Float32Array ? pcm : new Float32Array(pcm), sampleRate);
  });
}

function rendererUrl(): string | undefined {
  return process.env['ELECTRON_RENDERER_URL'];
}
function rendererFile(): string {
  return join(__dirname, '../renderer/index.html');
}

function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Caption',
    icon: resourcePath('icon.png'),
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
    mainWindow = null;
  });
  const url = rendererUrl();
  if (url) win.loadURL(url);
  else win.loadFile(rendererFile());
  mainWindow = win;
  return win;
}

const runtime = initAppRuntime({ appId: 'jm-caption', appName: 'JM Caption' });
void runtime;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  app.whenReady().then(() => {
    loadConfig();
    // Mikrofon-Zugriff für getUserMedia im Renderer erlauben.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');
    registerIpc();
    createMainWindow();
  });

  app.on('before-quit', () => stopTranscriber());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
