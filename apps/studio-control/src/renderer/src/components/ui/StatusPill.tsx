import type { ReactNode } from 'react';
import { cn } from '@jm/ui';

type Status = 'live' | 'setup' | 'done' | 'error' | 'info';

const STYLES: Record<Status, string> = {
  live:  'bg-[var(--brand-yellow)] text-[var(--brand-dark)]',
  setup: 'bg-[var(--brand-yellow-soft)] text-[var(--foreground)]',
  done:  'bg-[var(--muted)] text-[var(--muted-foreground)]',
  error: 'bg-[var(--destructive)] text-[var(--destructive-foreground)]',
  info:  'border border-[var(--border)] text-[var(--foreground)]',
};

interface Props {
  status: Status;
  children: ReactNode;
  className?: string;
}

export function StatusPill({ status, children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5',
        'text-xs uppercase tracking-wide font-extrabold',
        STYLES[status],
        className,
      )}
    >
      {children}
    </span>
  );
}
