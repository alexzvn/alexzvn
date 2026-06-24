import type { BattleState } from '@shared/types';
import { useBattle } from '@/store/useBattle';

function baseName(p: string): string {
  if (!p) return '';
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** Instant-Replay: Quell-Aufnahme wählen + letzte N Sekunden als Clip schneiden. */
export function ClipPanel({ state }: { state: BattleState }) {
  const { pickRecording, pickClipDir, clip, setConfig } = useBattle();
  const cfg = state.config;
  const running = state.clips.some((c) => c.status === 'running');

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Instant-Replay</h2>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <button onClick={() => void pickRecording()} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800">
            Aufnahme …
          </button>
          <span className="truncate text-neutral-400" title={cfg.recordingPath}>
            {cfg.recordingPath ? baseName(cfg.recordingPath) : 'keine Quelle gewählt'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void pickClipDir()} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800">
            Zielordner …
          </button>
          <span className="truncate text-neutral-500" title={cfg.clipDir}>
            {cfg.clipDir ? baseName(cfg.clipDir) : 'Standard (Videos/JM Battle Clips)'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Länge</span>
          <input
            type="number"
            min={3}
            max={120}
            value={cfg.clipSeconds}
            onChange={(e) => void setConfig({ clipSeconds: Math.max(3, Number(e.target.value) || 0) })}
            className="w-16 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-100"
          />
          <span className="text-neutral-500">Sekunden (letzte)</span>
        </div>
      </div>

      <button
        onClick={() => void clip()}
        disabled={!cfg.recordingPath || running}
        className="mt-3 w-full rounded-md bg-[var(--brand-yellow)] py-2 text-sm font-bold text-[var(--brand-dark)] disabled:opacity-40"
      >
        {running ? 'schneidet …' : `⧉ Clip (letzte ${cfg.clipSeconds}s)`}
      </button>

      {state.clips.length > 0 && (
        <div className="mt-3 space-y-1">
          {state.clips.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-[11px]">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  c.status === 'done' ? 'bg-green-500' : c.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}
              />
              <span className="truncate text-neutral-400" title={c.error ?? c.outputPath}>
                {c.status === 'error' ? c.error : c.status === 'running' ? `${c.seconds}s …` : baseName(c.outputPath)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
