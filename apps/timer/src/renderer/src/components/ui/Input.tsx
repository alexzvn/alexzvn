import type { InputHTMLAttributes } from 'react';
import { cn } from '@jm/ui';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'h-10 px-3 rounded-[var(--radius)]',
        'bg-[var(--input)] text-[var(--foreground)]',
        'border border-[var(--border)]',
        'placeholder:text-[var(--muted-foreground)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'tabular-nums',
        className,
      )}
    />
  );
}
