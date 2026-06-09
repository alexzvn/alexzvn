import type { ReactNode } from 'react';
import { cn } from '@jm/ui';

interface Props {
  children: ReactNode;
  className?: string;
}

export function SectionHeader({ children, className }: Props) {
  return (
    <h3
      className={cn(
        'text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]',
        className,
      )}
    >
      <span className="text-[var(--slash)] mr-2 font-extrabold">/</span>
      {children}
    </h3>
  );
}
