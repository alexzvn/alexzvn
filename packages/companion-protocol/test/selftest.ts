// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
import {
  parseCommand,
  formatState,
  parseState,
  createLineBuffer,
  type SwitcherStateMsg,
} from '../src/index.ts';

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

eq(parseCommand('PREVIEW 2'), { type: 'preview', scene: 2 }, 'PREVIEW 2');
eq(parseCommand('program 3'), { type: 'program', scene: 3 }, 'program 3 (case-insensitive)');
eq(parseCommand('CUT'), { type: 'cut' }, 'CUT');
eq(parseCommand('AUTO'), { type: 'auto' }, 'AUTO ohne ms');
eq(parseCommand('AUTO 500'), { type: 'auto', ms: 500 }, 'AUTO 500');
eq(parseCommand('RECORD START'), { type: 'record', on: true }, 'RECORD START');
eq(parseCommand('STREAM STOP'), { type: 'stream', on: false }, 'STREAM STOP');
eq(parseCommand('STATE?'), { type: 'queryState' }, 'STATE?');
eq(parseCommand('  '), null, 'Leerzeile → null');
eq(parseCommand('BLAH'), null, 'Unbekannt → null');
eq(parseCommand('RECORD'), null, 'RECORD ohne Arg → null');

const st: SwitcherStateMsg = { program: 2, preview: 1, recording: true, streaming: false, scenes: 3 };
eq(formatState(st), 'STATE program=2 preview=1 recording=1 streaming=0 scenes=3\n', 'formatState');
eq(parseState(formatState(st)), st, 'round-trip state');
eq(parseState('nope'), null, 'parseState Nicht-STATE → null');

const lines: string[] = [];
const feed = createLineBuffer((l) => lines.push(l));
feed('CUT\nPRE');
feed('VIEW 2\n');
eq(lines, ['CUT', 'PREVIEW 2'], 'LineBuffer splittet über Chunks');

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
