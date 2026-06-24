import type { BattleState, Side } from '@shared/types';
import { juryWins, voteTotals } from '@shared/scoring';
import { useBattle } from '@/store/useBattle';

const nameInp = 'w-full bg-transparent text-center text-2xl font-bold outline-none focus:bg-neutral-800/50 rounded px-1';
const crewInp = 'w-full bg-transparent text-center text-sm text-neutral-400 outline-none focus:bg-neutral-800/50 rounded px-1';

/** Kontrahenten A/B (editierbar) + Live-Gesamtstand (Jury-Rundensiege, Stimmen). */
export function Competitors({ state }: { state: BattleState }) {
  const { setCompetitor, swapCompetitors } = useBattle();
  const wins = juryWins(state.rounds);
  const votes = voteTotals(state.rounds);

  const Card = ({ side, color }: { side: Side; color: string }) => {
    const c = state.competitors[side];
    return (
      <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4" style={{ borderTopColor: color, borderTopWidth: 3 }}>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
          <span>Ecke {side}</span>
          <span className="tabular text-neutral-400">{votes[side]} Stimmen</span>
        </div>
        <input
          className={nameInp}
          value={c.name}
          onChange={(e) => void setCompetitor(side, { name: e.target.value })}
          spellCheck={false}
        />
        <input
          className={crewInp}
          value={c.crew}
          placeholder="Crew / Stadt"
          onChange={(e) => void setCompetitor(side, { crew: e.target.value })}
          spellCheck={false}
        />
        <div className="mt-2 text-center text-4xl font-black tabular" style={{ color }}>
          {wins[side]}
        </div>
        <div className="text-center text-[10px] uppercase tracking-wider text-neutral-600">Rundensiege</div>
      </div>
    );
  };

  return (
    <div className="flex items-stretch gap-3">
      <Card side="A" color="#3da5ff" />
      <div className="flex flex-col items-center justify-center gap-2">
        <span className="text-lg font-black text-neutral-500">VS</span>
        <button
          onClick={() => void swapCompetitors()}
          title="Ecken tauschen"
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
        >
          ⇄
        </button>
      </div>
      <Card side="B" color="#ff5c5c" />
    </div>
  );
}
