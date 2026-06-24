// Selbsttest der reinen Scoring-/Runden-Logik:
//   node --experimental-strip-types test/selftest.ts
import {
  makeRounds,
  resizeRounds,
  clampRound,
  setJuryWinner,
  addVote,
  clearVotes,
  juryWins,
  voteTotals,
  overallWinner,
  voteLeader,
  decided,
  encodeToken,
} from '../src/shared/scoring.ts';

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

// ── makeRounds ───────────────────────────────────────────────────────────────
eq(makeRounds(3).length, 3, 'makeRounds(3) → 3 Runden');
eq(makeRounds(3).map((r) => r.round), [1, 2, 3], 'Runden 1-basiert');
eq(makeRounds(0).length, 1, 'makeRounds klemmt nach unten auf 1');
eq(makeRounds(99).length, 20, 'makeRounds klemmt nach oben auf 20');

// ── resizeRounds behält Ergebnisse ───────────────────────────────────────────
let rounds = makeRounds(3);
rounds = setJuryWinner(rounds, 2, 'A');
rounds = addVote(rounds, 2, 'B');
const grown = resizeRounds(rounds, 5);
eq(grown.length, 5, 'resize auf 5');
eq(grown.find((r) => r.round === 2)?.juryWinner, 'A', 'Ergebnis Runde 2 bleibt nach resize');
eq(resizeRounds(rounds, 2).length, 2, 'resize kürzt auf 2');

// ── clampRound ───────────────────────────────────────────────────────────────
eq(clampRound(5, 3), 3, 'clampRound oben');
eq(clampRound(0, 3), 1, 'clampRound unten');

// ── Jury + Votes ─────────────────────────────────────────────────────────────
let r = makeRounds(3);
r = setJuryWinner(r, 1, 'A');
r = setJuryWinner(r, 2, 'B');
r = setJuryWinner(r, 3, 'A');
eq(juryWins(r), { A: 2, B: 1 }, 'juryWins zählt Rundensiege');
eq(overallWinner(r), 'A', 'overallWinner = A (2:1)');

let t = makeRounds(2);
t = setJuryWinner(t, 1, 'A');
t = setJuryWinner(t, 2, 'B');
eq(overallWinner(t), 'tie', 'Gleichstand → tie');
eq(setJuryWinner(t, 1, 'tie').filter((x) => x.juryWinner === 'tie').length, 1, 'Jury-Unentschieden setzbar');

let v = makeRounds(2);
v = addVote(v, 1, 'A');
v = addVote(v, 1, 'A');
v = addVote(v, 1, 'B');
v = addVote(v, 2, 'B');
eq(voteTotals(v), { A: 2, B: 2 }, 'voteTotals summiert über Runden');
eq(voteLeader(v), 'tie', 'voteLeader bei Gleichstand → tie');
eq(voteLeader(addVote(v, 2, 'B')), 'B', 'voteLeader → B nach weiterer Stimme');
eq(clearVotes(v, 1).find((x) => x.round === 1)?.votesA, 0, 'clearVotes setzt Runde zurück');

// ── decided ──────────────────────────────────────────────────────────────────
eq(decided(r), true, 'decided: alle Runden entschieden');
eq(decided(makeRounds(3)), false, 'decided: frische Runden nicht entschieden');
eq(decided(setJuryWinner(makeRounds(2), 1, 'A')), false, 'decided: nur teils entschieden → false');

// ── encodeToken ──────────────────────────────────────────────────────────────
eq(encodeToken('Lil Jay'), 'Lil_Jay', 'encodeToken Spaces → _');
eq(encodeToken('  '), '-', 'encodeToken leer → -');

console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);
