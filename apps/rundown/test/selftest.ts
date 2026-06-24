// Selbsttest der reinen Conductor-Logik (kein Framework):
//   node --experimental-strip-types test/selftest.ts
import { buildActionLine, clampIndex, mergeEndpoints, navigate } from '../src/shared/conductor.ts';
import type { RundownDoc } from '../src/shared/types.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed++;
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}

// ── buildActionLine ──────────────────────────────────────────────────────────
eq(buildActionLine('timer', 'start', []), 'TIMER START', 'timer start → TIMER START');
eq(buildActionLine('presenter', 'goto', [3]), 'PRESENTER GOTO 3', 'presenter goto 3');
eq(buildActionLine('titler', 'template', ['banner']), 'TITLER TEMPLATE banner', 'titler template banner');
eq(buildActionLine('switcher', 'program', [2]), 'PROGRAM 2', 'switcher program → KEIN NS');
eq(buildActionLine('switcher', 'cut', []), 'CUT', 'switcher cut');
eq(buildActionLine('player', 'cue', [5]), 'PLAYER CUE 5', 'player cue 5');

// ── clampIndex ───────────────────────────────────────────────────────────────
eq(clampIndex(5, 3), 2, 'clamp oben');
eq(clampIndex(-1, 3), 0, 'clamp unten');
eq(clampIndex(0, 0), 0, 'leeres Dokument → 0');

// ── navigate ─────────────────────────────────────────────────────────────────
const doc: RundownDoc = {
  schemaVersion: 1,
  name: 'Test',
  rows: [
    {
      id: 'r1',
      label: 'Opener',
      actions: [
        { id: 'a1', role: 'timer', verb: 'start', args: [], enabled: true },
        { id: 'a2', role: 'titler', verb: 'take', args: [], enabled: true },
        { id: 'a3', role: 'player', verb: 'cue', args: [1], enabled: false }, // deaktiviert
      ],
    },
    { id: 'r2', label: 'Talk', actions: [{ id: 'a4', role: 'presenter', verb: 'goto', args: [1], enabled: true }] },
    { id: 'r3', label: 'Outro', actions: [] },
  ],
};

const go0 = navigate(doc, 0, { t: 'go' });
eq(go0.index, 1, 'GO auf Zeile 0 → Index 1 (eins weiter)');
eq(go0.fire.map((a) => a.id), ['a1', 'a2'], 'GO feuert nur aktivierte Aktionen (a3 aus)');

eq(navigate(doc, 0, { t: 'next' }).index, 1, 'NEXT → +1');
eq(navigate(doc, 0, { t: 'next' }).fire.length, 0, 'NEXT feuert nicht');
eq(navigate(doc, 1, { t: 'prev' }).index, 0, 'PREV → -1');
eq(navigate(doc, 0, { t: 'prev' }).index, 0, 'PREV an der Untergrenze bleibt 0');
eq(navigate(doc, 2, { t: 'go' }).index, 2, 'GO auf letzter Zeile bleibt (clamp)');
eq(navigate(doc, 2, { t: 'go' }).fire.length, 0, 'GO auf leerer Zeile feuert nichts');
eq(navigate(doc, 0, { t: 'goto', n: 3 }).index, 2, 'GOTO 3 (1-basiert) → Index 2');
eq(navigate(doc, 0, { t: 'goto', n: 99 }).index, 2, 'GOTO über Ende → letzte Zeile');

// ── mergeEndpoints (mDNS + manuelle Overrides, Override gewinnt) ──────────────
eq(
  mergeEndpoints({ timer: { host: '10.0.0.5', port: 8724 } }, {}),
  { timer: { host: '10.0.0.5', port: 8724, source: 'mdns' } },
  'mDNS-Fund ohne Override → source mdns',
);
eq(
  mergeEndpoints(
    { timer: { host: '10.0.0.5', port: 8724 } },
    { timer: { host: '192.168.1.9', port: 8724 } },
  ),
  { timer: { host: '192.168.1.9', port: 8724, source: 'manual' } },
  'Override gewinnt über mDNS',
);
eq(
  mergeEndpoints({}, { switcher: { host: '192.168.1.2', port: 8723 } }),
  { switcher: { host: '192.168.1.2', port: 8723, source: 'manual' } },
  'reiner Override (kein mDNS) → source manual',
);

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
