import { cn } from '@jm/ui';
import type { InstallStatus } from '@shared/types';

export type StatusFilter = InstallStatus | 'Alle';

// Reihenfolge + deutsche Beschriftung der Status-Filter (Issue #14).
const STATUS_ORDER: StatusFilter[] = ['Alle', 'installed', 'update-available', 'not-installed'];
const STATUS_LABEL: Record<StatusFilter, string> = {
  Alle: 'Alle',
  installed: 'Installiert',
  'update-available': 'Update',
  'not-installed': 'Nicht installiert',
};

interface Props {
  active: StatusFilter;
  counts: Record<StatusFilter, number>;
  onChange: (status: StatusFilter) => void;
}

export function StatusChips({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_ORDER.map((status) => {
        const isActive = status === active;
        const count = counts[status] ?? 0;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={cn(
              'h-8 px-3.5 rounded-[var(--radius-full)] text-xs font-extrabold uppercase tracking-[0.1em]',
              'border transition-colors',
              isActive
                ? 'border-[var(--primary)] bg-[var(--highlight)] text-[var(--foreground)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)] hover:text-[var(--foreground)]',
            )}
          >
            {STATUS_LABEL[status]}
            <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
