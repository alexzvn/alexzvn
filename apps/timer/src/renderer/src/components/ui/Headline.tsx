import type { ReactNode } from 'react';
import { cn } from '@jm/ui';

type Variant = 'display' | 'page' | 'section' | 'subsection';

const STYLES: Record<Variant, string> = {
  display:    'text-[var(--text-5xl)] leading-[var(--leading-display)] tracking-[var(--tracking-tight)] uppercase font-extrabold',
  page:       'text-[var(--text-4xl)] leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] font-extrabold',
  section:    'text-[var(--text-2xl)] leading-[var(--leading-snug)] font-bold',
  subsection: 'text-[var(--text-xl)] leading-[var(--leading-snug)] font-semibold',
};

interface Props {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Headline({ variant = 'page', children, className }: Props) {
  const Tag = variant === 'display' || variant === 'page' ? 'h1' : variant === 'section' ? 'h2' : 'h3';
  return <Tag className={cn(STYLES[variant], className)}>{children}</Tag>;
}
