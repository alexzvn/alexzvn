import { useEffect, useState } from 'react';
import { useBattle } from '@/store/useBattle';
import { roleLabel } from '@/lib/capabilities';
import { decided, overallWinner } from '@shared/scoring';
import { Competitors } from '@/components/Competitors';
import { Scoreboard } from '@/components/Scoreboard';
import { RemotePanel } from '@/components/RemotePanel';
import { ClipPanel } from '@/components/ClipPanel';
import { Settings } from '@/components/Settings';
import { ConnectionsPanel } from '@/components/ConnectionsPanel';

const topBtn = 'rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800';

export function App() {
  const { state, load, setLive, setEndpoint } = useBattle();
  const [showSettings, setShowSettings] = useState(false);
  const [showConnections, setShowConnections] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) {
    return <div className="grid h-full place-items-center text-neutral-500">Lädt …</div>;
  }

  const isDecided = decided(state.rounds);
  const winner = overallWinner(state.rounds);
  const winnerName = winner === 'tie' ? 'Unentschieden' : state.competitors[winner].name;
  const titler = state.links.find((l) => l.role === 'titler');

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="font-bold">JM Battle</span>
        <span className="text-xs text-neutral-500">
          Runde {state.round}/{state.rounds.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void setLive(!state.live)}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
              state.live ? 'border-red-500 bg-red-600/20 text-red-300' : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
            }`}
            title="VS-Bauchbinde (Titler) on air"
          >
            {state.live ? '● VS on air' : '○ VS einblenden'}
          </button>
          <button onClick={() => setShowConnections(true)} className={topBtn}>Verbindungen</button>
          <button onClick={() => setShowSettings(true)} className={topBtn}>Einstellungen</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
          <Competitors state={state} />
          <Scoreboard state={state} />
          {isDecided && (
            <div className="rounded-xl border border-[var(--brand-yellow)]/50 bg-[var(--brand-yellow)]/10 p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">Ergebnis</div>
              <div className="text-2xl font-black text-[var(--brand-yellow)]">
                {winner === 'tie' ? '🤝 Unentschieden' : `🏆 ${winnerName}`}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
          <RemotePanel state={state} />
          <ClipPanel state={state} />
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${titler?.connected ? 'bg-green-500' : 'bg-neutral-600'}`} />
              <span className="text-neutral-300">{roleLabel('titler')}</span>
              <span className="ml-auto text-[11px] text-neutral-500">
                {titler?.connected ? `${titler.host}:${titler.port}` : 'getrennt'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">VS-Bauchbinde mit den Namen läuft über den Titler.</p>
          </div>
        </div>
      </div>

      {showSettings && <Settings config={state.config} onClose={() => setShowSettings(false)} />}
      {showConnections && (
        <ConnectionsPanel
          links={state.links}
          overrides={state.overrides}
          onSet={(role, host, port) => void setEndpoint(role, host, port)}
          onClose={() => setShowConnections(false)}
        />
      )}
    </div>
  );
}
