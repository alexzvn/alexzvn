import type { SelectHTMLAttributes } from 'react';
import { cn } from '@jm/ui';

export interface SelectOption {
  label: string;
  value: string;
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
}

export function Select({ options, label, className, ...rest }: Props) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
          {label}
        </span>
      )}
      <select
        {...rest}
        className={cn(
          'h-8 px-2 rounded-[var(--radius)] text-[12px]',
          'bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)]',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
          className,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
