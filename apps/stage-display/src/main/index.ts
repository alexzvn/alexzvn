import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { OutputWindow, listDisplays } from '@jm/output-window';
import type { PartialStageConfig, StageState } from '@shared/types';
import { getConfig, patchConfig } from './config';
import { TimerClient, TIMER_OFFLINE } from './timer-client';
import { SwitcherClient, SWITCHER_OFFLINE } from './switcher-client';
import { PresenterClient, PRESENTER_OFFLINE } from './presenter-client';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.mjs');
const output = new OutputWindow('stage:state');

let lastTimer = { ...TIMER_OFFLINE };
let lastSwitcher = { ...SWITCHER_OFFLINE };
let lastPresenter = { ...PRESENTER_OFFLINE };

const timerClient = new TimerClient((s) => {
  lastTimer = s;
  broadcast();
});
const switcherClient = new SwitcherClient((s) => {
  lastSwitcher = s;
  broadcast();
});
const presenterClient = new PresenterClient((s) => {
  lastPresenter = s;
  broadcast();
});

function buildState(): StageState {
  return {
    config: getConfig(),
    timer: lastTimer,
    switcher: lastSwitcher,
    presenter: lastPresenter,
  };
}

function broadcast(): void {
  const state = buildState();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('stage:state', state);
  output.send(state);
}

// Verbindungen an die aktuelle Config angleichen (nur reconnecten, wenn sich
// Host/Port/Enabled tatsächlich geändert haben — Widget-Toggles lösen nichts aus).
let appliedTimerKey = '';
let appliedSwitcherKey = '';
let appliedPresenterKey = '';
function applyConnections(): void {
  const cfg = getConfig();
  const tKey = cfg.timer.enabled ? `${cfg.timer.host}:${cfg.timer.port}` : '';
  if (tKey !== appliedTimerKey) {
    appliedTimerKey = tKey;
    if (tKey) timerClient.connect(cfg.timer.host, cfg.timer.port);
    else timerClient.disconnect();
  }
  const sKey = cfg.switcher.enabled ? `${cfg.switcher.host}:${cfg.switcher.port}` : '';
  if (sKey !== appliedSwitcherKey) {
    appliedSwitcherKey = sKey;
    if (sKey) switcherClient.connect(cfg.switcher.host, cfg.switcher.port);
    else switcherClient.disconnect();
  }
  const pKey = cfg.presenter.enabled
    ? `${cfg.presenter.host}:${cfg.presenter.port}:${cfg.presenter.pin}`
    : '';
  if (pKey !== appliedPresenterKey) {
    appliedPresenterKey = pKey;
    if (pKey) presenterClient.connect(cfg.presenter.host, cfg.presenter.port, cfg.presenter.pin);
    else presenterClient.disconnect();
  }
}

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
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
    width: 1080,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Stage Display',
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

function openOutput(displayId?: number): void {
  if (displayId != null) patchConfig({ outputDisplayId: displayId });
  output.open({
    preloadPath,
    rendererUrl: rendererUrl(),
    rendererFile: rendererFile(),
    hash: 'output',
    title: 'JM Stage Display — Ausgabe',
    displayId: displayId ?? getConfig().outputDisplayId ?? undefined,
  });
  // Frischen State sofort schicken, sobald das Fenster geladen hat.
  setTimeout(broadcast, 400);
}

function registerIpc(): void {
  ipcMain.handle('stage:getState', () => buildState());
  ipcMain.handle('stage:setConfig', (_e, patch: PartialStageConfig) => {
    patchConfig(patch);
    applyConnections();
    broadcast();
    return buildState();
  });
  ipcMain.handle('output:displays', () => listDisplays());
  ipcMain.handle('output:open', (_e, displayId?: number) => openOutput(displayId));
  ipcMain.handle('output:close', () => output.close());
  ipcMain.handle('output:isOpen', () => output.isOpen());
}

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
    registerIpc();
    createMainWindow();
    applyConnections();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
