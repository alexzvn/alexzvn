import type { QaConfig } from '@shared/types';
import { useQa } from '@/store/useQa';

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

/** Einstellungen: Redezeit + Auto-Kopplung (Timer/Titler) + Moderation. */
export function Settings({ config, onClose }: { config: QaConfig; onClose: () => void }) {
  const { setConfig } = useQa();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={onClose}>
      <div
        className="w-[34rem] rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center">
          <h2 className="text-lg font-semibold">Einstellungen</h2>
          <button onClick={onClose} className="ml-auto rounded px-2 text-neutral-400 hover:bg-neutral-800">
            ✕
          </button>
        </div>

        <Row label="Redezeit (Sekunden)" hint="Setzt den JM Timer beim Ans-Wort-Holen.">
          <input
            type="number"
            min={5}
            max={3600}
            value={config.speakSeconds}
            onChange={(e) => void setConfig({ speakSeconds: Math.max(5, Number(e.target.value) || 0) })}
            className={`${inp} w-24`}
          />
        </Row>

        <Row label="Redezeit-Timer automatisch" hint="JM Timer setzen + starten, wenn jemand ans Wort kommt.">
          <input type="checkbox" checked={config.autoTimer} onChange={(e) => void setConfig({ autoTimer: e.target.checked })} />
        </Row>

        <Row
          label="Bauchbinde automatisch"
          hint="JM Titler beim Ans-Wort-Holen ein-/ausblenden. Name/Funktion werden mitgesendet — ein Titler mit text-Befehl übernimmt sie automatisch."
        >
          <input type="checkbox" checked={config.autoTitler} onChange={(e) => void setConfig({ autoTitler: e.target.checked })} />
        </Row>

        <Row label="Titler-Vorlage">
          <select
            value={config.titlerTemplate}
            onChange={(e) => void setConfig({ titlerTemplate: e.target.value as QaConfig['titlerTemplate'] })}
            className={inp}
          >
            <option value="lowerthird">Bauchbinde</option>
            <option value="banner">Banner</option>
            <option value="ticker">Ticker</option>
          </select>
        </Row>

        <Row label="Moderation" hint="Saal-Einreichungen müssen erst freigegeben werden, bevor sie aufgerufen werden.">
          <input type="checkbox" checked={config.moderation} onChange={(e) => void setConfig({ moderation: e.target.checked })} />
        </Row>
      </div>
    </div>
  );
}
