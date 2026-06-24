import type { RundownNav, RundownState } from '@shared/types';

/** Großer GO-Knopf + Zurück/Weiter + Quittung der zuletzt gefeuerten Zeile. */
export function Transport({
  state,
  onNav,
}: {
  state: RundownState;
  onNav: (cmd: RundownNav) => void;
}) {
  const rows = state.doc.rows;
  const idx = state.index;
  const cur = rows[idx];
  const fired = state.lastFired;

  return (
    <div className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-900/70 px-4 py-3">
      <button
        onClick={() => onNav({ t: 'prev' })}
        className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        ◀ Zurück
      </button>
      <button
        onClick={() => onNav({ t: 'go' })}
        disabled={!cur}
        className="rounded-lg px-8 py-3 text-xl font-bold tracking-wide text-[var(--brand-dark)] shadow disabled:opacity-40"
        style={{ background: 'var(--brand-yellow)' }}
      >
        GO
      </button>
      <button
        onClick={() => onNav({ t: 'next' })}
        className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        Weiter ▶
      </button>

      <div className="ml-2 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">Scharf</div>
        <div className="truncate text-lg font-semibold">{cur ? cur.label : '—'}</div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {fired && (
          <div className="max-w-[28rem] text-right">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">
              Zuletzt gefeuert: {fired.rowLabel}
            </div>
            <div className="truncate text-xs text-neutral-400">
              {fired.sent.length
                ? fired.sent
                    .map((s) => `${s.line}${s.delivered ? '' : ' ⚠'}`)
                    .join('  ·  ')
                : 'keine Aktionen'}
            </div>
          </div>
        )}
        <div className="tabular text-sm text-neutral-400">
          {rows.length ? idx + 1 : 0} / {rows.length}
        </div>
      </div>
    </div>
  );
}
