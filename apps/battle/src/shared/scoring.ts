// Reine Scoring-/Runden-Logik (keine node/electron-Imports) — per Selftest ohne
// Electron prüfbar. Operiert immutabel auf RoundResult[].
import type { RoundResult, Side } from './types';

/** n leere Runden (1-basiert). */
export function makeRounds(n: number): RoundResult[] {
  const count = Math.max(1, Math.min(20, Math.round(n)));
  return Array.from({ length: count }, (_, i) => ({ round: i + 1, juryWinner: null, votesA: 0, votesB: 0 }));
}

/** Rundenzahl ändern, vorhandene Ergebnisse behalten (kürzen/auffüllen). */
export function resizeRounds(rounds: RoundResult[], n: number): RoundResult[] {
  const target = makeRounds(n);
  return target.map((r) => rounds.find((x) => x.round === r.round) ?? r);
}

/** Runde in [1, len] klemmen. */
export function clampRound(r: number, len: number): number {
  if (len <= 0) return 1;
  return Math.max(1, Math.min(Math.trunc(r), len));
}

export function setJuryWinner(rounds: RoundResult[], round: number, winner: Side | 'tie' | null): RoundResult[] {
  return rounds.map((r) => (r.round === round ? { ...r, juryWinner: winner } : r));
}

export function addVote(rounds: RoundResult[], round: number, side: Side): RoundResult[] {
  return rounds.map((r) =>
    r.round === round ? { ...r, votesA: r.votesA + (side === 'A' ? 1 : 0), votesB: r.votesB + (side === 'B' ? 1 : 0) } : r,
  );
}

export function clearVotes(rounds: RoundResult[], round: number): RoundResult[] {
  return rounds.map((r) => (r.round === round ? { ...r, votesA: 0, votesB: 0 } : r));
}

/** Jury-Rundensiege je Seite (Unentschieden/offen zählen nicht). */
export function juryWins(rounds: RoundResult[]): { A: number; B: number } {
  let A = 0;
  let B = 0;
  for (const r of rounds) {
    if (r.juryWinner === 'A') A++;
    else if (r.juryWinner === 'B') B++;
  }
  return { A, B };
}

/** Publikumsstimmen gesamt je Seite. */
export function voteTotals(rounds: RoundResult[]): { A: number; B: number } {
  let A = 0;
  let B = 0;
  for (const r of rounds) {
    A += r.votesA;
    B += r.votesB;
  }
  return { A, B };
}

/** Gesamtsieger nach Jury-Rundensiegen (Gleichstand → 'tie'). */
export function overallWinner(rounds: RoundResult[]): Side | 'tie' {
  const { A, B } = juryWins(rounds);
  if (A > B) return 'A';
  if (B > A) return 'B';
  return 'tie';
}

/** Publikums-Favorit nach Gesamtstimmen (Gleichstand/0 → 'tie'). */
export function voteLeader(rounds: RoundResult[]): Side | 'tie' {
  const { A, B } = voteTotals(rounds);
  if (A > B) return 'A';
  if (B > A) return 'B';
  return 'tie';
}

/** Alle Runden von der Jury entschieden (inkl. Unentschieden gesetzt)? */
export function decided(rounds: RoundResult[]): boolean {
  return rounds.length > 0 && rounds.every((r) => r.juryWinner !== null);
}

/** Token fürs whitespace-getrennte Protokoll (Spaces → '_', leer → '-'). */
export function encodeToken(s: string): string {
  const t = (s ?? '').trim().replace(/\s+/g, '_');
  return t.length ? t : '-';
}
