import { app, ipcMain } from 'electron';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

// ─────────────────────────────────────────────────────────────────────────────
// @jm/app-runtime — einmaliger Main-Prozess-Layer, den jede App ganz früh ruft.
//
// Bündelt vier Querschnitts-Themen, die sonst in jeder App fehlten:
//   1. Logging        → Datei-Logs in userData/logs mit Rotation
//   2. Crash-Handler  → uncaughtException/unhandledRejection ins Log + Marker
//   3. Deep-Links     → jmps://… / --show <pfad> parsen (OS-Handler optional)
//   4. Presence       → Heartbeat an den Launcher-Hub (Health-Dashboard)
//
// Bewusst OHNE externe Abhängigkeiten (nur node:* + electron), weil das Paket
// von electron-vite in den App-Main gebündelt wird (siehe externalizeDepsPlugin
// `exclude`) und gepackte Apps kein node_modules mitliefern.
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void;
  info(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
}

export interface AppRuntimeOptions {
  /** Stabile Tool-ID (z. B. "jm-timer") — für Logs, Presence, Heartbeat. */
  appId: string;
  /** Anzeigename (z. B. "JM Timer"). Default: appId. */
  appName?: string;
  /** App-Version (Default: app.getVersion()). */
  version?: string;
  /** Port, falls die App einen Server betreibt (z. B. Timer 7777). */
  servicePort?: number;
  /** Callback für eingehende Deep-Links (jmps://… oder --show <pfad>). */
  onDeepLink?: (url: string) => void;
  /**
   * Diese App als OS-Handler für `jmps://` registrieren. Standard false —
   * i. d. R. besitzt nur der Launcher das Protokoll und reicht es an die
   * Tools weiter. Andere Apps verarbeiten Deep-Links trotzdem, wenn sie damit
   * gestartet werden (argv / second-instance).
   */
  registerProtocol?: boolean;
  /** Presence-Heartbeat an den Launcher-Hub senden (Default true). */
  presence?: boolean;
  /** Untere Log-Schwelle (Default: 'debug' im Dev, sonst 'info'). */
  level?: LogLevel;
}

export interface AppRuntime {
  log: Logger;
  /** Deep-Link/Datei, mit der die App gestartet wurde (falls vorhanden). */
  initialDeepLink: string | null;
  /** Verzeichnis der Log-Dateien (userData/logs). */
  logDir: string;
}

export const PROTOCOL = 'jmps';
const DEFAULT_HUB = 'http://127.0.0.1:7799';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB pro Datei
const MAX_FILES = 5; // main.log + main.log.1 … main.log.4
const HEARTBEAT_MS = 10_000;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let defaultLogger: Logger | null = null;

// ── Logging ──────────────────────────────────────────────────────────────────

function fmtArg(v: unknown): string {
  if (v instanceof Error) return v.stack ?? `${v.name}: ${v.message}`;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function resolveLogDir(): string {
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    return path.join(os.tmpdir(), 'jmps-logs');
  }
}

/** Rotiert die Datei, sobald sie MAX_BYTES überschreitet (main.log → .1 → …). */
function rotateIfNeeded(file: string): void {
  try {
    if (!existsSync(file) || statSync(file).size < MAX_BYTES) return;
    const oldest = `${file}.${MAX_FILES - 1}`;
    if (existsSync(oldest)) rmSync(oldest, { force: true });
    for (let i = MAX_FILES - 2; i >= 1; i--) {
      const src = `${file}.${i}`;
      if (existsSync(src)) renameSync(src, `${file}.${i + 1}`);
    }
    renameSync(file, `${file}.1`);
  } catch {
    /* Rotation darf niemals den Logger sprengen */
  }
}

function createLogger(opts: {
  appId: string;
  logDir: string;
  fileName: string;
  level: LogLevel;
  toConsole: boolean;
}): Logger {
  const file = path.join(opts.logDir, opts.fileName);
  const threshold = LEVEL_ORDER[opts.level];

  const write = (level: LogLevel, msg: string, rest: unknown[]): void => {
    if (LEVEL_ORDER[level] < threshold) return;
    const extra = rest.length ? ' ' + rest.map(fmtArg).join(' ') : '';
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] [${opts.appId}] ${msg}${extra}\n`;
    try {
      rotateIfNeeded(file);
      appendFileSync(file, line);
    } catch {
      /* Logging darf nie werfen */
    }
    if (opts.toConsole) {
      const sink =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log;
      sink(line.trimEnd());
    }
  };

  return {
    debug: (m, ...r) => write('debug', m, r),
    info: (m, ...r) => write('info', m, r),
    warn: (m, ...r) => write('warn', m, r),
    error: (m, ...r) => write('error', m, r),
  };
}

function consoleFallback(): Logger {
  return {
    debug: (m, ...r) => console.debug(m, ...r),
    info: (m, ...r) => console.log(m, ...r),
    warn: (m, ...r) => console.warn(m, ...r),
    error: (m, ...r) => console.error(m, ...r),
  };
}

// ── Crash-Handler ────────────────────────────────────────────────────────────

function installCrashHandlers(log: Logger, logDir: string, appId: string): void {
  const record = (kind: string, err: unknown): void => {
    const e = err instanceof Error ? err : new Error(String(err));
    log.error(`${kind}: ${e.message}`, e);
    try {
      writeFileSync(
        path.join(logDir, 'last-crash.json'),
        JSON.stringify(
          {
            appId,
            kind,
            message: e.message,
            stack: e.stack ?? null,
            at: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } catch {
      /* Marker ist best-effort */
    }
  };

  process.on('uncaughtException', (err) => record('uncaughtException', err));
  process.on('unhandledRejection', (reason) =>
    record('unhandledRejection', reason),
  );
}

/** Liest die zuletzt geschriebene Crash-Marke (aus einem früheren Lauf). */
function readLastCrash(logDir: string): { kind: string; at: string } | null {
  try {
    const raw = readFileSync(path.join(logDir, 'last-crash.json'), 'utf8');
    const j = JSON.parse(raw) as { kind?: unknown; at?: unknown };
    if (j && typeof j.at === 'string') {
      return { kind: typeof j.kind === 'string' ? j.kind : 'crash', at: j.at };
    }
  } catch {
    /* keine Crash-Marke vorhanden */
  }
  return null;
}

// ── Deep-Links ───────────────────────────────────────────────────────────────

/** Findet eine jmps://-URL oder ein `--show <pfad>` in einer argv-Liste. */
export function findDeepLink(argv: readonly string[]): string | null {
  for (const a of argv) {
    if (a.startsWith(`${PROTOCOL}://`)) return a;
  }
  const idx = argv.indexOf('--show');
  if (idx >= 0 && argv[idx + 1]) {
    return `${PROTOCOL}://open?show=${encodeURIComponent(argv[idx + 1])}`;
  }
  return null;
}

function setupDeepLinks(
  onUrl: (url: string) => void,
  registerProtocol: boolean,
): string | null {
  if (registerProtocol) {
    try {
      // Im Dev läuft die App über das Electron-Binary (process.defaultApp):
      // Pfad zum Einstiegsskript mitgeben, sonst zeigt der Handler auf electron.exe.
      if (process.defaultApp && process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
          path.resolve(process.argv[1]),
        ]);
      } else {
        app.setAsDefaultProtocolClient(PROTOCOL);
      }
    } catch {
      /* Registrierung ist optional */
    }
  }

  // macOS liefert Deep-Links über open-url (nur wenn als Handler registriert).
  app.on('open-url', (event, url) => {
    event.preventDefault();
    onUrl(url);
  });

  // Windows/Linux: zweite Instanz bekommt die URL via argv (mehrere Listener
  // sind erlaubt — der App-eigene second-instance-Handler bleibt unberührt).
  app.on('second-instance', (_event, argv) => {
    const url = findDeepLink(argv);
    if (url) onUrl(url);
  });

  return findDeepLink(process.argv);
}

// ── Presence-Heartbeat ───────────────────────────────────────────────────────

function startPresence(info: {
  appId: string;
  name: string;
  version: string;
  servicePort?: number;
  logDir: string;
  lastCrash: { kind: string; at: string } | null;
}): void {
  const hub = process.env['JMPS_HUB_URL'] || DEFAULT_HUB;
  let target: URL;
  try {
    target = new URL('/presence', hub);
  } catch {
    return;
  }

  const send = (event: 'hello' | 'beat' | 'bye'): void => {
    try {
      const body = JSON.stringify({ ...info, pid: process.pid, event });
      const req = http.request({
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 1500,
      });
      // Hub läuft evtl. nicht — Fehler bewusst verschlucken (best-effort).
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end(body);
    } catch {
      /* best-effort */
    }
  };

  send('hello');
  const timer = setInterval(() => send('beat'), HEARTBEAT_MS);
  timer.unref?.();
  app.on('before-quit', () => {
    clearInterval(timer);
    send('bye');
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialisiert den geteilten Runtime-Layer. So früh wie möglich im Main-Modul
 * aufrufen (vor app.whenReady), damit Crash-Handler auch frühe Fehler fangen.
 */
export function initAppRuntime(opts: AppRuntimeOptions): AppRuntime {
  const isDev = !app.isPackaged;
  const level: LogLevel = opts.level ?? (isDev ? 'debug' : 'info');
  const version = opts.version ?? safeGetVersion();
  const logDir = resolveLogDir();
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    /* notfalls schreibt der Logger einfach nichts */
  }

  const log = createLogger({
    appId: opts.appId,
    logDir,
    fileName: 'main.log',
    level,
    toConsole: isDev,
  });
  defaultLogger = log;

  installCrashHandlers(log, logDir, opts.appId);

  // Optionaler Kanal für Renderer-Logs (App kann ihn über die Preload-Bridge
  // füttern: ipcRenderer.send('jmps:log', level, msg, ...rest)).
  const rendererLog = createLogger({
    appId: opts.appId,
    logDir,
    fileName: 'renderer.log',
    level,
    toConsole: isDev,
  });
  try {
    ipcMain.on(
      'jmps:log',
      (_e, lvl: LogLevel, msg: string, ...rest: unknown[]) => {
        const fn = rendererLog[lvl] ?? rendererLog.info;
        fn(msg, ...rest);
      },
    );
  } catch {
    /* ipcMain evtl. (noch) nicht verfügbar */
  }

  let initialDeepLink: string | null;
  if (opts.onDeepLink) {
    initialDeepLink = setupDeepLinks(
      opts.onDeepLink,
      opts.registerProtocol ?? false,
    );
  } else {
    initialDeepLink = findDeepLink(process.argv);
  }

  if (opts.presence !== false) {
    startPresence({
      appId: opts.appId,
      name: opts.appName ?? opts.appId,
      version,
      servicePort: opts.servicePort,
      logDir,
      lastCrash: readLastCrash(logDir),
    });
  }

  log.info(
    `runtime gestartet (v${version}, dev=${isDev})` +
      (initialDeepLink ? ` deepLink=${initialDeepLink}` : ''),
  );

  return { log, initialDeepLink, logDir };
}

/** Der zuletzt initialisierte Logger (oder ein Konsolen-Fallback vor init). */
export function getLog(): Logger {
  return defaultLogger ?? consoleFallback();
}

function safeGetVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
}
