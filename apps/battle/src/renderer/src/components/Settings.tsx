import type { BattleConfig } from '@shared/types';
import { useBattle } from '@/store/useBattle';

const inp = 'rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-800/60 py-2.5">
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-neutral-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** Einstellungen: Runden, Voting, VS-Bauchbinde + Battle zurücksetzen. */
export function Settings({ config, onClose }: { config: BattleConfig; onClose: () => void }) {
  const { setConfig, reset } = useBattle();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={onClose}>
      <div className="w-[34rem] rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center">
          <h2 className="text-lg font-semibold">Einstellungen</h2>
          <button onClick={onClose} className="ml-auto rounded px-2 text-neutral-400 hover:bg-neutral-800">✕</button>
        </div>

        <Row label="Runden" hint="Anzahl der Battle-Runden.">
          <input
            type="number"
            min={1}
            max={20}
            value={config.rounds}
            onChange={(e) => void setConfig({ rounds: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
            className={`${inp} w-20`}
          />
        </Row>

        <Row label="Publikums-Voting" hint="Abstimmung per QR/Handy zulassen.">
          <input type="checkbox" checked={config.votingEnabled} onChange={(e) => void setConfig({ votingEnabled: e.target.checked })} />
        </Row>

        <Row label="VS-Bauchbinde automatisch" hint="JM Titler bei VS-Live mit den Namen ein-/ausblenden (text-Befehl vorwärtskompatibel).">
          <input type="checkbox" checked={config.autoTitler} onChange={(e) => void setConfig({ autoTitler: e.target.checked })} />
        </Row>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              if (confirm('Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben).')) {
                void reset();
                onClose();
              }
            }}
            className="rounded-md border border-red-700/60 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
          >
            Battle zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
}
