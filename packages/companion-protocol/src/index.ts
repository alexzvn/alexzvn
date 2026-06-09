// Geteiltes TCP-Zeilenprotokoll der JM-Switcher-Fernsteuerung.
//
// Zeilenbasiert, ASCII, `\n`-terminiert. Der Switcher öffnet einen TCP-Server;
// ein Client (z. B. das Bitfocus-Companion-Modul) sendet Befehle und empfängt
// Status. Szenen werden 1-basiert adressiert (wie in der UI sichtbar).
//
//   Befehle (Client → Switcher):
//     PREVIEW <n>        Preview auf Szene n setzen
//     PROGRAM <n>        Program direkt auf Szene n (harter Schnitt)
//     CUT                Program = Preview (hart)
//     AUTO [ms]          Übergang Preview → Program (Dissolve)
//     RECORD START|STOP  Aufnahme schalten
//     STREAM START|STOP  RTMP-Stream schalten
//     STATE?             aktuellen Status anfordern
//
//   Status (Switcher → Client), bei jeder Änderung + auf Verbindung/STATE?:
//     STATE program=<n> preview=<n> recording=<0|1> streaming=<0|1> scenes=<n>

export const DEFAULT_CONTROL_PORT = 8723;

export type ControlCommand =
  | { type: 'preview'; scene: number }
  | { type: 'program'; scene: number }
  | { type: 'cut' }
  | { type: 'auto'; ms?: number }
  | { type: 'record'; on: boolean }
  | { type: 'stream'; on: boolean }
  | { type: 'queryState' };

export interface SwitcherStateMsg {
  /** 1-basierter Index der Program-Szene (0 = keine). */
  program: number;
  /** 1-basierter Index der Preview-Szene (0 = keine). */
  preview: number;
  recording: boolean;
  streaming: boolean;
  /** Anzahl Szenen (für Companion-Range/Dropdowns). */
  scenes: number;
}

/** Eine Befehlszeile parsen. Liefert null bei Leer-/Unbekanntzeilen. */
export function parseCommand(line: string): ControlCommand | null {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  const verb = parts[0].toUpperCase();
  switch (verb) {
    case 'PREVIEW': {
      const n = Number(parts[1]);
      return Number.isFinite(n) ? { type: 'preview', scene: Math.trunc(n) } : null;
    }
    case 'PROGRAM': {
      const n = Number(parts[1]);
      return Number.isFinite(n) ? { type: 'program', scene: Math.trunc(n) } : null;
    }
    case 'CUT':
      return { type: 'cut' };
    case 'AUTO': {
      if (parts[1] == null) return { type: 'auto' };
      const ms = Number(parts[1]);
      return Number.isFinite(ms) ? { type: 'auto', ms: Math.max(0, Math.trunc(ms)) } : { type: 'auto' };
    }
    case 'RECORD': {
      const on = onOff(parts[1]);
      return on == null ? null : { type: 'record', on };
    }
    case 'STREAM': {
      const on = onOff(parts[1]);
      return on == null ? null : { type: 'stream', on };
    }
    case 'STATE?':
    case 'STATE':
      return { type: 'queryState' };
    default:
      return null;
  }
}

function onOff(s: string | undefined): boolean | null {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u === 'START' || u === 'ON' || u === '1' || u === 'TRUE') return true;
  if (u === 'STOP' || u === 'OFF' || u === '0' || u === 'FALSE') return false;
  return null;
}

/** Status-Zeile bauen (mit `\n`). */
export function formatState(s: SwitcherStateMsg): string {
  return (
    `STATE program=${s.program} preview=${s.preview} ` +
    `recording=${s.recording ? 1 : 0} streaming=${s.streaming ? 1 : 0} scenes=${s.scenes}\n`
  );
}

/** Status-Zeile parsen (Client-Seite). Liefert null, wenn keine STATE-Zeile. */
export function parseState(line: string): SwitcherStateMsg | null {
  const t = line.trim();
  if (!/^STATE\s/i.test(t)) return null;
  const kv = new Map<string, string>();
  for (const tok of t.split(/\s+/).slice(1)) {
    const eq = tok.indexOf('=');
    if (eq > 0) kv.set(tok.slice(0, eq).toLowerCase(), tok.slice(eq + 1));
  }
  const num = (k: string): number => {
    const n = Number(kv.get(k));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    program: num('program'),
    preview: num('preview'),
    recording: kv.get('recording') === '1',
    streaming: kv.get('streaming') === '1',
    scenes: num('scenes'),
  };
}

/**
 * Zeilenpuffer für TCP-Streams: füttert rohe Chunks, ruft `onLine` je
 * vollständiger `\n`-terminierter Zeile. Beide Seiten nutzen ihn.
 */
export function createLineBuffer(onLine: (line: string) => void): (chunk: string) => void {
  let buf = '';
  return (chunk: string): void => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) onLine(line);
    }
  };
}
