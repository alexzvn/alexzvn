import { SectionHeader } from '@/components/ui/SectionHeader';
import { cn } from '@jm/ui';

interface Props {
  ndiSource?: string;
  className?: string;
}

export function PgmPreview({ ndiSource, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <SectionHeader>PGM Vorschau</SectionHeader>
        <span className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--primary)]">
          Phase 2
        </span>
      </div>
      <div
        className={cn(
          'relative w-full aspect-video overflow-hidden',
          'rounded-[var(--radius-md)] border border-[var(--border)]/60',
          'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),rgba(0,0,0,0.6))]',
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 12px, transparent 12px 24px)',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
          <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-[var(--primary)]">
            NDI · TriCaster PGM
          </span>
          <span className="text-sm text-[var(--muted-foreground)]">
            Live-Vorschau folgt in Phase 2 (NDI 6 / NDI HX → re-encoded für Browser).
          </span>
          {ndiSource && (
            <code className="mt-1 text-[10px] text-[var(--muted-foreground)] tabular-nums">
              {ndiSource}
            </code>
          )}
        </div>
        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--card)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-extrabold">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]" />
          Kein Stream
        </span>
        <span className="absolute bottom-2 right-2 rounded-[var(--radius-sm)] bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          16:9
        </span>
      </div>
    </div>
  );
}
