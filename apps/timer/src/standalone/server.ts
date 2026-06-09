/**
 * Standalone Node server for environments without a desktop (Codespaces, CI, headless Linux).
 * Runs the same Socket.IO sync server and serves the built renderer over HTTP — no Electron.
 *
 *   npm run dev:codespace
 *
 * Then open the forwarded port 7777 in a browser. The renderer detects the
 * absence of `window.jm` and falls back to deriving its socket URL from the
 * current origin, so Operator / Speaker / Remote views all just work in tabs.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Server as IoServer } from 'socket.io';
import {
  DEFAULT_COLORS,
  INITIAL_STATE,
  reduce,
  type Command,
  type SyncedState,
} from '../shared/timer-state.ts';

const PORT = Number(process.env.PORT) || 7777;
const HOST = '0.0.0.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/standalone/ → up two → repo root → out/renderer
const RENDERER_DIR = path.resolve(__dirname, '../../out/renderer');
const STATE_FILE = path.join(os.homedir(), '.jm-timer-state.json');

// ─── state ────────────────────────────────────────────────────────────────────

let state: SyncedState = INITIAL_STATE;

function loadState(): void {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SyncedState>;
    state = {
      countdown: {
        durationMs:
          parsed.countdown?.durationMs ?? INITIAL_STATE.countdown.durationMs,
        delayMs: 0,
        startedAtMs: null,
        pausedRemainingMs: null,
      },
      colors: { ...DEFAULT_COLORS, ...(parsed.colors ?? {}) },
      timetable: {
        items: Array.isArray(parsed.timetable?.items)
          ? parsed.timetable!.items
          : [],
        activeIndex: null,
      },
      message: {
        text: typeof parsed.message?.text === 'string' ? parsed.message.text : '',
        blinking: false,
      },
    };
  } catch {
    /* first run */
  }
}

function persist(): void {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          countdown: { durationMs: state.countdown.durationMs },
          colors: state.colors,
          timetable: { items: state.timetable.items },
          message: { text: state.message.text },
        },
        null,
        2,
      ),
      'utf-8',
    );
  } catch {
    /* ignore */
  }
}

function dispatch(cmd: Command): SyncedState {
  state = reduce(state, cmd);
  persist();
  return state;
}

// ─── static file serving ──────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let urlPath = url.pathname;
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const safe = path.normalize(path.join(RENDERER_DIR, urlPath));
  if (!safe.startsWith(RENDERER_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(safe, (err, stat) => {
    if (err || !stat.isFile()) {
      const idx = path.join(RENDERER_DIR, 'index.html');
      fs.readFile(idx, (e2, data) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not found — run `npm run build` first.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    const mime = MIME[path.extname(safe).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    fs.createReadStream(safe).pipe(res);
  });
}

// ─── boot ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(path.join(RENDERER_DIR, 'index.html'))) {
  console.error('[jm-timer] Renderer build not found at', RENDERER_DIR);
  console.error('[jm-timer] Run `npm run build` first.');
  process.exit(1);
}

loadState();

const http = createServer((req, res) => {
  if (req.url?.split('?')[0] === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mode: 'standalone' }));
    return;
  }
  serveStatic(req, res);
});

const io = new IoServer(http, {
  cors: { origin: '*' },
  pingTimeout: 4000,
  pingInterval: 2000,
});

io.on('connection', (socket) => {
  socket.emit('state', state);
  socket.on('cmd', (cmd: Command) => {
    try {
      const next = dispatch(cmd);
      io.emit('state', next);
    } catch (err) {
      console.error('[jm-timer] bad command', cmd, err);
    }
  });
});

http.listen(PORT, HOST, () => {
  const lan = listLanAddresses();
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  JM Timer (standalone) listening on ${HOST}:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  State file: ${STATE_FILE}`);
  if (lan.length > 0) {
    console.log('  LAN access:');
    for (const ip of lan) {
      console.log(`    Operator: http://${ip}:${PORT}/`);
      console.log(`    Speaker:  http://${ip}:${PORT}/?view=speaker`);
      console.log(`    Remote:   http://${ip}:${PORT}/?view=remote`);
    }
  }
  console.log('');
  console.log('  In a Codespace, open the forwarded port 7777 in a browser tab.');
  console.log('  Append ?view=speaker or ?view=remote for the Speaker view.');
  console.log('');
});

function listLanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        out.push(iface.address);
      }
    }
  }
  return out;
}
