import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { OutputWindow, listDisplays } from '@jm/output-window';
import { RemoteServer } from '@jm/remote';
import { INITIAL_TRANSPORT, positionEm } from '@shared/types';
import type { PartialPrompterConfig, PrompterState, PrompterTransport, RemoteInfo } from '@shared/types';
import { getConfig, patchConfig } from './config';
import { readScriptFile } from './docx';
import { REMOTE_PAGE } from './remote-page';

declare const __dirname: string;

const REMOTE_PORT = 7781;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.mjs');
const output = new OutputWindow('prompter:state');

// Transport gehört dem Main-Prozess; die Renderer interpolieren nur.
let transport: PrompterTransport = {
  ...INITIAL_TRANSPORT,
  emPerSec: getEmPerSec(),
};

// Handy-Fernbedienung (HTTP/SSE).
const remote = new RemoteServer({
  port: REMOTE_PORT,
  page: REMOTE_PAGE,
  getState: () => ({ playing: transport.playing, speed: getConfig().speed }),
  onCommand: (cmd) => handleRemoteCommand(cmd),
});

function getEmPerSec(): number {
  const c = getConfig();
  return c.speed * c.lineHeight;
}

function remoteInfo(): RemoteInfo {
  const addr = remote.address();
  return { running: remote.isRunning(), urls: addr?.urls ?? [] };
}

function buildState(): PrompterState {
  return { config: getConfig(), transport, remote: remoteInfo() };
}

function broadcast(): void {
  const state = buildState();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('prompter:state', state);
  output.send(state);
  remote.broadcast({ playing: transport.playing, speed: getConfig().speed });
}

function handleRemoteCommand(cmd: unknown): void {
  const c = cmd as { type?: string; value?: number } | null;
  if (!c || typeof c.type !== 'string') return;
  switch (c.type) {
    case 'toggle':
      transport.playing ? pause() : play();
      break;
    case 'play':
      play();
      break;
    case 'pause':
      pause();
      break;
    case 'nudge':
      nudge(Number(c.value) || 0);
      break;
    case 'reset':
      reset();
      break;
    case 'speed': {
      const next = Math.max(0.2, Math.min(6, getConfig().speed + (Number(c.value) || 0)));
      patchConfig({ speed: Math.round(next * 10) / 10 });
      reanchor();
      broadcast();
      break;
    }
  }
}

async function setRemote(enabled: boolean): Promise<void> {
  patchConfig({ remoteEnabled: enabled });
  try {
    if (enabled) await remote.start();
    else await remote.stop();
  } catch (err) {
    console.error('[prompter] Fernbedienung:', err);
  }
  broadcast();
}

/** Anker auf die aktuelle Position neu setzen (z. B. nach Tempo-/Zeilenabstand-Änderung). */
function reanchor(now: number = Date.now()): void {
  transport = {
    ...transport,
    anchorEm: positionEm(transport, now),
    anchorAtMs: now,
    emPerSec: getEmPerSec(),
  };
}

function play(): void {
  if (transport.playing) return;
  transport = {
    ...transport,
    playing: true,
    anchorEm: positionEm(transport),
    anchorAtMs: Date.now(),
    emPerSec: getEmPerSec(),
  };
  broadcast();
}

function pause(): void {
  if (!transport.playing) return;
  transport = {
    ...transport,
    playing: false,
    anchorEm: positionEm(transport),
    anchorAtMs: Date.now(),
  };
  broadcast();
}

function seek(em: number): void {
  transport = {
    ...transport,
    anchorEm: Math.max(0, em),
    anchorAtMs: Date.now(),
    emPerSec: getEmPerSec(),
  };
  broadcast();
}

function nudge(deltaEm: number): void {
  seek(positionEm(transport) + deltaEm);
}

function reset(): void {
  transport = {
    ...transport,
    playing: false,
    anchorEm: 0,
    anchorAtMs: Date.now(),
    emPerSec: getEmPerSec(),
  };
  broadcast();
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
    width: 1180,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Prompter',
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
    title: 'JM Prompter — Ausgabe',
    displayId: displayId ?? getConfig().outputDisplayId ?? undefined,
  });
  // Frischen State sofort schicken, sobald das Fenster geladen hat.
  setTimeout(broadcast, 400);
}

function registerIpc(): void {
  ipcMain.handle('prompter:getState', () => buildState());
  ipcMain.handle('prompter:setConfig', (_e, patch: PartialPrompterConfig) => {
    patchConfig(patch);
    // Tempo/Zeilenabstand wirken sofort: Anker neu setzen, damit kein Sprung.
    if (patch.speed !== undefined || patch.lineHeight !== undefined) reanchor();
    broadcast();
    return buildState();
  });

  // Skript aus Datei laden: .docx (entpackt) oder .txt/.md (Issue #28).
  ipcMain.handle('prompter:importScript', async () => {
    if (!mainWindow) return buildState();
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Skript laden',
      properties: ['openFile'],
      filters: [
        { name: 'Skript / Word', extensions: ['docx', 'txt', 'md', 'markdown'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (r.canceled || r.filePaths.length === 0) return buildState();
    const text = readScriptFile(r.filePaths[0]); // wirft bei Lese-/Parse-Fehler
    patchConfig({ script: text });
    broadcast();
    return buildState();
  });

  ipcMain.handle('prompter:play', () => (play(), buildState()));
  ipcMain.handle('prompter:pause', () => (pause(), buildState()));
  ipcMain.handle('prompter:toggle', () => (transport.playing ? pause() : play(), buildState()));
  ipcMain.handle('prompter:seek', (_e, em: number) => (seek(em), buildState()));
  ipcMain.handle('prompter:nudge', (_e, deltaEm: number) => (nudge(deltaEm), buildState()));
  ipcMain.handle('prompter:reset', () => (reset(), buildState()));

  ipcMain.handle('prompter:setRemote', async (_e, enabled: boolean) => {
    await setRemote(enabled);
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
    // Fernbedienung automatisch starten, wenn zuletzt aktiv.
    if (getConfig().remoteEnabled) void setRemote(true);
  });

  app.on('before-quit', () => {
    void remote.stop();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
