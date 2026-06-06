import { app, BrowserWindow, screen, shell } from 'electron';
import path, { join } from 'node:path';
import type { DisplayInfo, ViewName } from '@shared/types';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.mjs');

let editorWindow: BrowserWindow | null = null;
let presenterWindow: BrowserWindow | null = null;
let audienceWindow: BrowserWindow | null = null;

// Invoked when a presentation window is closed by the user, so the hub can end
// the presentation cleanly. Registered by present.ts to avoid an import cycle.
let onPresentationWindowClosed: (() => void) | null = null;
export function setPresentationClosedHandler(cb: () => void): void {
  onPresentationWindowClosed = cb;
}

function resourcePath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function loadView(win: BrowserWindow, view: ViewName): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    void win.loadURL(`${rendererUrl}/?view=${view}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), {
      search: `view=${view}`,
    });
  }
}

const baseWebPreferences = {
  preload: preloadPath,
  sandbox: false,
  contextIsolation: true,
  nodeIntegration: false,
} as const;

export function createEditorWindow(): BrowserWindow {
  if (editorWindow && !editorWindow.isDestroyed()) {
    if (editorWindow.isMinimized()) editorWindow.restore();
    editorWindow.focus();
    return editorWindow;
  }
  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Presenter',
    icon: resourcePath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: baseWebPreferences,
  });

  win.on('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => {
    editorWindow = null;
  });

  loadView(win, 'editor');
  editorWindow = win;
  return win;
}

export function openPresenterWindow(): BrowserWindow {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    if (presenterWindow.isMinimized()) presenterWindow.restore();
    presenterWindow.focus();
    return presenterWindow;
  }
  // Prefer the primary display for the presenter (operator) window.
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.workArea;
  const win = new BrowserWindow({
    x: x + Math.round((width - Math.min(width, 1500)) / 2),
    y: y + Math.round((height - Math.min(height, 920)) / 2),
    width: Math.min(width, 1500),
    height: Math.min(height, 920),
    minWidth: 1024,
    minHeight: 620,
    backgroundColor: '#0c0c0c',
    show: false,
    title: 'JM Presenter · Referent',
    icon: resourcePath('icon.png'),
    autoHideMenuBar: true,
    webPreferences: baseWebPreferences,
  });
  win.on('ready-to-show', () => win.show());
  win.on('closed', () => {
    presenterWindow = null;
    onPresentationWindowClosed?.();
  });
  loadView(win, 'presenter');
  presenterWindow = win;
  return win;
}

function displayById(id: number): Electron.Display {
  return screen.getAllDisplays().find((d) => d.id === id) ?? screen.getPrimaryDisplay();
}

export function openAudienceWindow(displayId: number | null): BrowserWindow {
  const primary = screen.getPrimaryDisplay();
  const target =
    displayId != null
      ? displayById(displayId)
      : screen.getAllDisplays().find((d) => d.id !== primary.id) ?? primary;

  if (audienceWindow && !audienceWindow.isDestroyed()) {
    moveAudienceToDisplay(target.id);
    return audienceWindow;
  }

  const { x, y, width, height } = target.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    backgroundColor: '#000000',
    show: false,
    title: 'JM Presenter · Publikum',
    icon: resourcePath('icon.png'),
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: baseWebPreferences,
  });
  win.on('ready-to-show', () => {
    win.show();
    win.setFullScreen(true);
  });
  win.on('closed', () => {
    audienceWindow = null;
    onPresentationWindowClosed?.();
  });
  loadView(win, 'audience');
  audienceWindow = win;
  return win;
}

export function moveAudienceToDisplay(displayId: number): void {
  if (!audienceWindow || audienceWindow.isDestroyed()) return;
  const target = displayById(displayId);
  const wasFull = audienceWindow.isFullScreen();
  if (wasFull) audienceWindow.setFullScreen(false);
  audienceWindow.setBounds(target.bounds);
  // Re-enter fullscreen after the bounds move settles on the new display.
  audienceWindow.once('move', () => {
    if (audienceWindow && !audienceWindow.isDestroyed()) audienceWindow.setFullScreen(true);
  });
  audienceWindow.setFullScreen(true);
}

export function toggleAudienceFullscreen(): boolean {
  if (!audienceWindow || audienceWindow.isDestroyed()) return false;
  const next = !audienceWindow.isFullScreen();
  audienceWindow.setFullScreen(next);
  return next;
}

export function closePresentationWindows(): void {
  if (audienceWindow && !audienceWindow.isDestroyed()) audienceWindow.close();
  if (presenterWindow && !presenterWindow.isDestroyed()) presenterWindow.close();
  audienceWindow = null;
  presenterWindow = null;
}

export function getDisplays(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  const audienceDisplay =
    audienceWindow && !audienceWindow.isDestroyed()
      ? screen.getDisplayMatching(audienceWindow.getBounds())
      : null;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: `Bildschirm ${i + 1}${d.id === primary.id ? ' (Haupt)' : ''} · ${d.size.width}×${d.size.height}`,
    bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
    primary: d.id === primary.id,
    current: audienceDisplay?.id === d.id,
  }));
}

/** Broadcast an IPC message to every live window. */
export function broadcastAll(channel: string, payload: unknown): void {
  for (const win of [editorWindow, presenterWindow, audienceWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function getEditorWindow(): BrowserWindow | null {
  return editorWindow;
}

export function hasPresentationWindows(): boolean {
  return (
    (presenterWindow != null && !presenterWindow.isDestroyed()) ||
    (audienceWindow != null && !audienceWindow.isDestroyed())
  );
}
