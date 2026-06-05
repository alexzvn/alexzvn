import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'muted';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children?: ReactNode;
}

const TONE: Record<Tone, string> = {
  neutral:
    'border-[var(--primary)]/40 bg-[var(--highlight)] text-[var(--foreground)]',
  success:
    'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]',
  warning:
    'border-[var(--warning)]/50 bg-[var(--warning)]/15 text-[var(--warning)]',
  muted:
    'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
};

export function Badge({ tone = 'neutral', className, children, ...rest }: Props) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border',
        'px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
