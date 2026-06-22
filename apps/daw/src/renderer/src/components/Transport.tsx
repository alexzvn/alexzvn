import { cn } from '@jm/ui';
import { projectDurationUs } from '@shared/project';
import { useProject } from '@/store/project';
import { formatTimecode } from '@/lib/format';

export function Transport() {
  const playing = useProject((s) => s.playing);
  const setPlaying = useProject((s) => s.setPlaying);
  const playheadUs = useProject((s) => s.playheadUs);
  const setPlayhead = useProject((s) => s.setPlayhead);
  const present = useProject((s) => s.present);
  const totalUs = projectDurationUs(present);

  return (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--border)]/50 bg-[var(--card)]/40">
      <TpButton label="⏮" title="Anfang" onClick={() => setPlayhead(0)} />
      <button
        type="button"
        title={playing ? 'Pause (Leertaste)' : 'Wiedergabe (Leertaste)'}
        onClick={() => setPlaying(!playing)}
        className={cn(
          'h-9 w-12 rounded-[var(--radius)] text-base font-bold transition-colors',
          playing
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
            : 'border border-[var(--border)] hover:bg-[var(--highlight)]',
        )}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <TpButton label="⏭" title="Ende" onClick={() => setPlayhead(totalUs)} />

      <div className="ml-3 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-lg font-extrabold tracking-tight">{formatTimecode(playheadUs)}</span>
        <span className="text-[11px] text-[var(--muted-foreground)]">/ {formatTimecode(totalUs)}</span>
      </div>
    </div>
  );
}

function TpButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="h-9 w-9 rounded-[var(--radius)] border border-[var(--border)] text-sm hover:bg-[var(--highlight)]"
    >
      {label}
    </button>
  );
}
