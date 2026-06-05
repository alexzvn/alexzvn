import { cn } from '@jm/ui';
import type { ToolCategory } from '@shared/types';

export type CategoryFilter = ToolCategory | 'Alle';

interface Props {
  categories: CategoryFilter[];
  active: CategoryFilter;
  onChange: (category: CategoryFilter) => void;
}

export function CategoryChips({ categories, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map((category) => {
        const isActive = category === active;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={cn(
              'h-8 px-3.5 rounded-[var(--radius-full)] text-xs font-extrabold uppercase tracking-[0.1em]',
              'border transition-colors',
              isActive
                ? 'border-[var(--primary)] bg-[var(--highlight)] text-[var(--foreground)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)] hover:text-[var(--foreground)]',
            )}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
