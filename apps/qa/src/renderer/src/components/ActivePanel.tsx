import type { QaState } from '@shared/types';

const endBtn = 'rounded-md px-4 py-1.5 text-sm font-semibold text-white';
const nextBtn =
  'rounded-md px-4 py-1.5 text-sm font-semibold text-[var(--brand-dark)]';

/** Großer „Am Wort"-Block: aktiver Sprecher + Redezeit (vom Timer) + Beenden/Nächste. */
export function ActivePanel({
  state,
  onEnd,
  onNext,
}: {
  state: QaState;
  onEnd: () => void;
  onNext: () => void;
}) {
  const active = state.entries.find((e) => e.id === state.activeId) ?? null;
  const timer = state.links.find((l) => l.role === 'timer');
  const remaining = timer?.state?.remaining;
  const running = timer?.state?.running === '1';
  const overrun = timer?.state?.overrun === '1';

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">Am Wort</span>
        {remaining && (
          <span
            className={`tabular text-sm ${overrun ? 'text-red-400' : running ? 'text-green-400' : 'text-neutral-500'}`}
            title="Redezeit (vom JM Timer)"
          >
            ⏱ {remaining}
          </span>
        )}
      </div>

      {active ? (
        <>
          <div className="text-3xl font-semibold leading-tight">{active.name}</div>
          {active.affiliation && <div className="text-lg text-neutral-400">{active.affiliation}</div>}
          {active.question && (
            <div className="mt-2 rounded-lg bg-neutral-800/60 px-3 py-2 text-sm text-neutral-300">
              {active.question}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={onEnd} className={endBtn} style={{ background: '#e0533d' }}>
              ■ Beenden
            </button>
            <button onClick={onNext} className={nextBtn} style={{ background: 'var(--brand-yellow)' }}>
              Nächste ▶
            </button>
          </div>
        </>
      ) : (
        <div className="py-3 text-sm text-neutral-500">
          Niemand am Wort. „Nächste" ruft die erste Wortmeldung auf.
          <div className="mt-3">
            <button onClick={onNext} className={nextBtn} style={{ background: 'var(--brand-yellow)' }}>
              Nächste ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
