import { useEffect, useState } from 'react';
import type { BattleState } from '@shared/types';
import { useBattle } from '@/store/useBattle';
import { toDataUrl } from '@/lib/qr';

/** Publikums-Voting: QR + LAN-URLs, Server an/aus, Voting der Runde öffnen/schließen. */
export function RemotePanel({ state }: { state: BattleState }) {
  const { setRemote, setVotingOpen } = useBattle();
  const [qr, setQr] = useState('');
  const url = state.remote.urls[0] ?? '';

  useEffect(() => {
    let cancelled = false;
    if (url) {
      void toDataUrl(url)
        .then((d) => !cancelled && setQr(d))
        .catch(() => setQr(''));
    } else {
      setQr('');
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-300">Publikums-Voting</h2>
        <button
          onClick={() => void setRemote(!state.remote.running)}
          className={`ml-auto rounded-md border px-2.5 py-1 text-xs font-semibold ${
            state.remote.running ? 'border-green-500 bg-green-600/20 text-green-300' : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          {state.remote.running ? '◉ An' : '○ Aus'}
        </button>
      </div>

      {state.remote.running ? (
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR zum Voting" className="rounded-lg bg-white p-1.5" width={170} height={170} />
          ) : (
            <div className="grid h-[170px] w-[170px] place-items-center rounded-lg bg-neutral-800 text-xs text-neutral-500">kein Netzwerk</div>
          )}
          <button
            onClick={() => void setVotingOpen(!state.votingOpen)}
            disabled={!state.config.votingEnabled}
            className={`w-full rounded-md py-2 text-sm font-bold ${
              state.votingOpen ? 'bg-[var(--brand-yellow)] text-[var(--brand-dark)]' : 'border border-neutral-700 text-neutral-200 hover:bg-neutral-800'
            } disabled:opacity-40`}
          >
            {state.votingOpen ? `Voting offen (Runde ${state.round}) — schließen` : `Voting öffnen (Runde ${state.round})`}
          </button>
          <div className="w-full space-y-0.5">
            {state.remote.urls.map((u) => (
              <div key={u} className="truncate rounded bg-neutral-800/60 px-2 py-1 text-center text-[11px] text-neutral-300">{u}</div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Aus. Anschalten, damit das Publikum per Handy (QR) für die Runden abstimmt.</p>
      )}
    </div>
  );
}
