import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'destructive' | 'link';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  uppercase?: boolean;
  children?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
  accent:
    'bg-[var(--accent)] text-[var(--foreground)] hover:opacity-90',
  outline:
    'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--highlight)]',
  ghost:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--highlight)]',
  destructive:
    'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90',
  link:
    'bg-transparent text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--primary)]',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  uppercase = true,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius)]',
        'font-extrabold tracking-wide',
        'transition-opacity transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        uppercase && 'uppercase',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
