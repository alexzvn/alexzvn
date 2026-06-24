import type { BattleState, Side } from '@shared/types';
import { useBattle } from '@/store/useBattle';

const A_COLOR = '#3da5ff';
const B_COLOR = '#ff5c5c';

/** Runden-Navigation + Jury-Entscheid der aktuellen Runde + Voting-Balken. */
export function Scoreboard({ state }: { state: BattleState }) {
  const { prevRound, nextRound, gotoRound, setJuryWinner, clearVotes } = useBattle();
  const cur = state.rounds.find((r) => r.round === state.round);
  const total = state.competitors;

  const juryBtn = (winner: Side | 'tie', label: string, color: string): React.ReactNode => {
    const active = cur?.juryWinner === winner;
    return (
      <button
        onClick={() => void setJuryWinner(state.round, active ? null : winner)}
        className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition"
        style={{
          borderColor: active ? color : '#3f3f46',
          background: active ? `${color}22` : 'transparent',
          color: active ? color : '#d4d4d8',
        }}
      >
        {label}
      </button>
    );
  };

  const totalVotes = (cur?.votesA ?? 0) + (cur?.votesB ?? 0);
  const pctA = totalVotes > 0 ? Math.round(((cur?.votesA ?? 0) / totalVotes) * 100) : 50;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      {/* Runden-Navigation */}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => void prevRound()} className="rounded-md border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800">◀</button>
        <div className="flex flex-1 flex-wrap justify-center gap-1.5">
          {state.rounds.map((r) => {
            const isCur = r.round === state.round;
            const mark = r.juryWinner === 'A' ? A_COLOR : r.juryWinner === 'B' ? B_COLOR : r.juryWinner === 'tie' ? '#a3a3a3' : null;
            return (
              <button
                key={r.round}
                onClick={() => void gotoRound(r.round)}
                className={`h-8 w-8 rounded-md border text-sm font-semibold ${isCur ? 'border-[var(--brand-yellow)]' : 'border-neutral-700'}`}
                style={{ background: mark ? `${mark}33` : 'transparent' }}
                title={r.juryWinner ? `Runde ${r.round}: ${r.juryWinner}` : `Runde ${r.round}`}
              >
                {r.round}
              </button>
            );
          })}
        </div>
        <button onClick={() => void nextRound()} className="rounded-md border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800">▶</button>
      </div>

      <div className="mb-1 text-center text-[10px] uppercase tracking-wider text-neutral-500">
        Jury — Runde {state.round}
      </div>
      <div className="flex gap-2">
        {juryBtn('A', total.A.name || 'A', A_COLOR)}
        {juryBtn('tie', 'Unentschieden', '#a3a3a3')}
        {juryBtn('B', total.B.name || 'B', B_COLOR)}
      </div>

      {/* Voting-Balken */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
          <span>Publikum — Runde {state.round}</span>
          <button onClick={() => void clearVotes(state.round)} className="text-neutral-500 hover:text-neutral-300">zurücksetzen</button>
        </div>
        <div className="flex items-center gap-2 text-sm tabular">
          <span style={{ color: A_COLOR }} className="w-10 text-right font-semibold">{cur?.votesA ?? 0}</span>
          <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <div style={{ width: `${pctA}%`, background: A_COLOR }} className="h-full transition-[width]" />
            <div style={{ width: `${100 - pctA}%`, background: B_COLOR }} className="h-full transition-[width]" />
          </div>
          <span style={{ color: B_COLOR }} className="w-10 font-semibold">{cur?.votesB ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
