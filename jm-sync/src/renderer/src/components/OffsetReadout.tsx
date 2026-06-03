import type { MeasurementStats } from '@shared/types';

interface Props {
  stats: MeasurementStats | null;
}

/** Big headline readout of the measured A/V offset. */
export function OffsetReadout({ stats }: Props) {
  if (!stats) {
    return (
      <div className="py-6">
        <div className="text-5xl font-extrabold tracking-tight text-[var(--muted-foreground)]">
          — ms
        </div>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Messung läuft – warte auf die ersten Blitz-/Piep-Zyklen…
        </p>
      </div>
    );
  }

  const ms = stats.medianMs;
  const lead =
    Math.abs(ms) < 1
      ? 'synchron'
      : ms > 0
        ? 'Audio führt'
        : 'Video führt';

  return (
    <div className="py-2">
      <div className="flex items-baseline gap-3 tabular">
        <span className="text-6xl font-extrabold tracking-tight">
          {ms >= 0 ? '+' : ''}
          {ms.toFixed(1)}
        </span>
        <span className="text-2xl font-bold text-[var(--muted-foreground)]">ms</span>
      </div>
      <div className="mt-2 text-lg font-bold text-[var(--primary)]">{lead}</div>

      <div className="mt-5 grid grid-cols-3 gap-3 max-w-md tabular">
        <Stat label="Jitter (MAD)" value={`±${stats.madMs.toFixed(1)} ms`} />
        <Stat label="Bereich" value={`${stats.minMs.toFixed(0)}…${stats.maxMs.toFixed(0)}`} />
        <Stat label="Messungen" value={String(stats.count)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)]/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-extrabold">{value}</div>
    </div>
  );
}
