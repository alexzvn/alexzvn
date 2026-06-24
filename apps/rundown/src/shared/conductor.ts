// Reine Conductor-Logik (keine node/electron-Imports) — damit per Selftest
// (test/selftest.ts) ohne Electron prüfbar. Baut Protokollzeilen für das suite-
// weite Zeilenprotokoll (@jm/suite-control-protocol) und rechnet die Navigation
// über das Rundown-Dokument aus.
import type { Endpoint, RundownAction, RundownDoc, RundownNav } from './types';

/** Endpunkt + woher er stammt. */
export interface DesiredEndpoint extends Endpoint {
  source: 'mdns' | 'manual';
}

/**
 * Gewünschte Steuer-Endpunkte je Rolle aus mDNS-Funden und manuellen Overrides
 * zusammenführen — der manuelle Override gewinnt (Cross-Subnet / mDNS aus).
 */
export function mergeEndpoints(
  discovered: Record<string, Endpoint>,
  overrides: Record<string, Endpoint>,
): Record<string, DesiredEndpoint> {
  const out: Record<string, DesiredEndpoint> = {};
  for (const [role, ep] of Object.entries(discovered)) out[role] = { host: ep.host, port: ep.port, source: 'mdns' };
  for (const [role, ep] of Object.entries(overrides)) out[role] = { host: ep.host, port: ep.port, source: 'manual' };
  return out;
}

/**
 * Protokollzeile für eine Aktion bauen. Switcher-Verben haben KEINEN Namespace
 * (Rückwärtskompat), alle anderen Rollen `<ROLLE> <VERB> [args]`.
 *   buildActionLine('timer','start',[])      → 'TIMER START'
 *   buildActionLine('presenter','goto',[3])  → 'PRESENTER GOTO 3'
 *   buildActionLine('switcher','program',[2])→ 'PROGRAM 2'
 */
export function buildActionLine(role: string, verb: string, args: (string | number)[] = []): string {
  const v = verb.toUpperCase();
  const tail = args.length ? ' ' + args.map((a) => String(a)).join(' ') : '';
  return role === 'switcher' ? `${v}${tail}` : `${role.toUpperCase()} ${v}${tail}`;
}

let _idCounter = 0;
/** Kurze, eindeutige ID für Zeilen/Aktionen (Editor + Default-Dokument). */
export function newId(prefix = 'x'): string {
  return `${prefix}_${Date.now().toString(36)}${(_idCounter++).toString(36)}`;
}

/** Index in [0, len-1] klemmen (leeres Dokument → 0). */
export function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(i), len - 1));
}

/**
 * Navigation auf dem Dokument auswerten. Liefert den neuen Index der scharfen
 * Zeile und — nur bei GO — die zu feuernden (aktivierten) Aktionen. GO rückt die
 * Markierung um eins weiter (Cue-Stack), NEXT/PREV/GOTO verschieben ohne Feuern.
 */
export function navigate(
  doc: RundownDoc,
  index: number,
  cmd: RundownNav,
): { index: number; fire: RundownAction[] } {
  const len = doc.rows.length;
  const cur = clampIndex(index, len);
  switch (cmd.t) {
    case 'go': {
      const row = doc.rows[cur];
      const fire = row ? row.actions.filter((a) => a.enabled) : [];
      return { index: clampIndex(cur + 1, len), fire };
    }
    case 'next':
      return { index: clampIndex(cur + 1, len), fire: [] };
    case 'prev':
      return { index: clampIndex(cur - 1, len), fire: [] };
    case 'goto':
      return { index: clampIndex(cmd.n - 1, len), fire: [] };
    default:
      return { index: cur, fire: [] };
  }
}
