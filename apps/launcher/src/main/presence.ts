import http from 'node:http';
import type { PresenceRecord } from '@shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Presence-Hub — der Launcher ist der zentrale Empfänger der Tool-Heartbeats.
//
// Jedes Tool meldet über @jm/app-runtime per POST /presence (hello/beat/bye).
// Der Hub hält den Laufzeit-Zustand und gibt ihn dem Renderer via IPC. Er pusht
// nur, wenn sich die Menge der laufenden Tools ändert (nicht bei jedem Beat) —
// das „vor X Sekunden gesehen" tickt die UI lokal aus `lastSeen`.
// ─────────────────────────────────────────────────────────────────────────────

const HUB_HOST = '127.0.0.1';
const HUB_PORT = 7799;
const STALE_MS = 25_000; // ~2,5 Heartbeats ohne Lebenszeichen → gilt als gestoppt
const SWEEP_MS = 5_000; // wie oft auf stale gewordene Tools geprüft wird
const MAX_BODY = 64 * 1024;

interface Beat {
  appId?: string;
  name?: string;
  version?: string;
  pid?: number;
  servicePort?: number;
  logDir?: string;
  event?: 'hello' | 'beat' | 'bye';
  lastCrash?: { kind: string; at: string } | null;
}

interface Entry {
  appId: string;
  name: string;
  version: string;
  pid: number;
  servicePort?: number;
  logDir?: string;
  lastSeen: number;
  stopped: boolean;
  lastCrash: { kind: string; at: string } | null;
}

const entries = new Map<string, Entry>();
let server: http.Server | null = null;
let notify: (() => void) | null = null;
let lastSignature = '';

function isRunning(e: Entry): boolean {
  return !e.stopped && Date.now() - e.lastSeen < STALE_MS;
}

function snapshot(): PresenceRecord[] {
  return [...entries.values()]
    .map((e) => ({
      appId: e.appId,
      name: e.name,
      version: e.version,
      pid: e.pid,
      servicePort: e.servicePort,
      running: isRunning(e),
      lastSeen: e.lastSeen,
      lastCrash: e.lastCrash,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Pusht nur, wenn sich die Menge der laufenden Tools tatsächlich geändert hat. */
function maybeNotify(): void {
  const sig = snapshot()
    .filter((r) => r.running)
    .map((r) => `${r.appId}@${r.version}`)
    .join(',');
  if (sig !== lastSignature) {
    lastSignature = sig;
    notify?.();
  }
}

function handleBeat(beat: Beat): void {
  if (!beat.appId) return;
  const prev = entries.get(beat.appId);

  if (beat.event === 'bye') {
    if (prev) {
      prev.stopped = true;
      prev.lastSeen = Date.now();
    }
    maybeNotify();
    return;
  }

  entries.set(beat.appId, {
    appId: beat.appId,
    name: beat.name ?? prev?.name ?? beat.appId,
    version: beat.version ?? prev?.version ?? '?',
    pid: beat.pid ?? prev?.pid ?? 0,
    servicePort: beat.servicePort ?? prev?.servicePort,
    logDir: beat.logDir ?? prev?.logDir,
    lastSeen: Date.now(),
    stopped: false,
    lastCrash: beat.lastCrash ?? prev?.lastCrash ?? null,
  });
  maybeNotify();
}

/**
 * Startet den lokalen Presence-Hub. `onChange` wird gerufen, sobald sich die
 * Menge der laufenden Tools ändert (Empfehlung: emitAppEvent presence-changed).
 */
export function startPresenceHub(onChange: () => void): void {
  if (server) return;
  notify = onChange;

  server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/presence') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY) req.destroy();
      });
      req.on('end', () => {
        try {
          handleBeat(JSON.parse(body) as Beat);
        } catch {
          /* fehlerhafte Beats ignorieren */
        }
        res.writeHead(204);
        res.end();
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  // Port belegt o. Ä. → Hub bleibt einfach aus, der Launcher läuft normal weiter.
  server.on('error', () => {
    server = null;
  });
  server.listen(HUB_PORT, HUB_HOST);

  // Stale gewordene Tools erkennen (Crash ohne "bye" sendet kein Lebenszeichen).
  const sweep = setInterval(maybeNotify, SWEEP_MS);
  sweep.unref?.();
}

/** Aktueller Laufzeit-Zustand aller bekannten Tools (für die UI). */
export function getPresence(): PresenceRecord[] {
  return snapshot();
}

/**
 * Log-Verzeichnisse aller Tools, die sich in dieser Sitzung gemeldet haben —
 * Grundlage für den Log-Anhang im Feedback (Fehlerberichte).
 */
export function getLogSources(): { appId: string; name: string; logDir: string }[] {
  return [...entries.values()]
    .filter((e): e is Entry & { logDir: string } => Boolean(e.logDir))
    .map((e) => ({ appId: e.appId, name: e.name, logDir: e.logDir }));
}
