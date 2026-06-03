import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: 'major' | 'nested';
  glossy?: boolean;
  children?: ReactNode;
}

export function Card({ variant = 'major', glossy = true, className, children, ...rest }: Props) {
  const isMajor = variant === 'major';
  return (
    <div
      {...rest}
      className={cn(
        'relative',
        isMajor
          ? 'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]'
          : 'rounded-[var(--radius-lg)] border border-[var(--border)]/40 bg-[var(--card)]/40 backdrop-blur-sm',
        className,
      )}
    >
      {glossy && isMajor && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-[var(--radius-xl)]
                     bg-gradient-to-b from-[var(--highlight)] to-transparent opacity-70"
        />
      )}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px',
          'bg-gradient-to-r from-transparent to-transparent',
          isMajor ? 'via-[var(--primary)]/40' : 'via-[var(--primary)]/30',
        )}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
