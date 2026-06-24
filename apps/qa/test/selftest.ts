// Selbsttest der reinen Queue-Logik (kein Framework):
//   node --experimental-strip-types test/selftest.ts
import {
  makeEntry,
  updateEntry,
  setStatus,
  setApproved,
  remove,
  move,
  activate,
  endActive,
  activeEntry,
  nextWaiting,
  clearDone,
  waitingCount,
  encodeToken,
} from '../src/shared/queue.ts';
import type { QaEntry } from '../src/shared/types.ts';

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

// ── makeEntry: säubern + begrenzen ───────────────────────────────────────────
const e1 = makeEntry({ name: '  Max Mustermann  ', affiliation: 'ARD', question: 'Frage?' }, 'operator', true, 'id1', 100);
eq(e1.name, 'Max Mustermann', 'makeEntry trimmt Namen');
eq(e1.affiliation, 'ARD', 'makeEntry affiliation');
eq(e1.status, 'waiting', 'makeEntry startet wartend');
eq(e1.source, 'operator', 'makeEntry source');
eq(makeEntry({ name: '   ' }, 'remote', false, 'id2', 1).name, 'Unbenannt', 'leerer Name → Unbenannt');
eq(makeEntry({ name: 'X'.repeat(200) }, 'operator', true, 'id3', 1).name.length, 80, 'Name auf 80 begrenzt');

const list: QaEntry[] = [
  makeEntry({ name: 'A' }, 'operator', true, 'a', 1),
  makeEntry({ name: 'B' }, 'remote', false, 'b', 2),
  makeEntry({ name: 'C' }, 'operator', true, 'c', 3),
];

// ── updateEntry ──────────────────────────────────────────────────────────────
eq(updateEntry(list, 'b', { affiliation: 'ZDF' }).find((e) => e.id === 'b')?.affiliation, 'ZDF', 'updateEntry affiliation');
eq(updateEntry(list, 'b', { name: '  ' }).find((e) => e.id === 'b')?.name, 'B', 'updateEntry leerer Name behält alt');

// ── activate: genau einer aktiv ──────────────────────────────────────────────
const act1 = activate(list, 'a');
eq(act1.find((e) => e.id === 'a')?.status, 'active', 'activate a → active');
const act2 = activate(act1, 'c');
eq(act2.find((e) => e.id === 'a')?.status, 'done', 'vorher aktiver a → done');
eq(act2.find((e) => e.id === 'c')?.status, 'active', 'neuer c → active');
eq(act2.filter((e) => e.status === 'active').length, 1, 'immer nur einer aktiv');
eq(activate(act2, 'b').find((e) => e.id === 'b')?.approved, true, 'activate gibt frei (approved)');
eq(activeEntry(act2)?.id, 'c', 'activeEntry findet c');

// ── endActive ────────────────────────────────────────────────────────────────
eq(activeEntry(endActive(act2)), null, 'endActive → kein aktiver mehr');

// ── nextWaiting (Moderation respektiert approved) ────────────────────────────
eq(nextWaiting(list, false)?.id, 'a', 'nextWaiting ohne Moderation → erster wartender');
eq(nextWaiting(list, true)?.id, 'a', 'nextWaiting mit Moderation → erster freigegebener (a)');
const onlyB = [list[1]]; // b: remote, nicht freigegeben
eq(nextWaiting(onlyB, true), null, 'Moderation: nicht freigegebener b zählt nicht');
eq(nextWaiting(onlyB, false)?.id, 'b', 'ohne Moderation zählt b doch');
eq(setApproved(onlyB, 'b', true)[0].approved, true, 'setApproved');

// ── waitingCount ─────────────────────────────────────────────────────────────
eq(waitingCount(list, true), 2, 'waitingCount mit Moderation (a,c freigegeben)');
eq(waitingCount(list, false), 3, 'waitingCount ohne Moderation = 3');
eq(waitingCount(act2, false), 1, 'waitingCount: nur b wartet noch');

// ── move (Grenzen) ───────────────────────────────────────────────────────────
eq(move(list, 'a', -1).map((e) => e.id), ['a', 'b', 'c'], 'move a hoch an Grenze bleibt');
eq(move(list, 'a', 1).map((e) => e.id), ['b', 'a', 'c'], 'move a runter');
eq(move(list, 'c', 1).map((e) => e.id), ['a', 'b', 'c'], 'move c runter an Grenze bleibt');

// ── remove / setStatus / clearDone ───────────────────────────────────────────
eq(remove(list, 'b').map((e) => e.id), ['a', 'c'], 'remove b');
eq(setStatus(list, 'a', 'done').find((e) => e.id === 'a')?.status, 'done', 'setStatus a done');
eq(clearDone(setStatus(list, 'a', 'done')).map((e) => e.id), ['b', 'c'], 'clearDone entfernt erledigte');

// ── encodeToken (Protokoll-sicher) ───────────────────────────────────────────
eq(encodeToken('Max Mustermann'), 'Max_Mustermann', 'encodeToken Spaces → _');
eq(encodeToken('  '), '-', 'encodeToken leer → -');
eq(encodeToken('Geschäftsführer · ARD'), 'Geschäftsführer_·_ARD', 'encodeToken behält Sonderzeichen');

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
