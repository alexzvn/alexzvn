import type { ReactNode } from 'react';
import { Card } from '@jm/ui';

interface Props {
  badge: string;
  title: string;
  lead: string;
  points: string[];
  children?: ReactNode;
}

/** Phase 0 stand-in for a feature view — same shell/look as the real views to come. */
export function Placeholder({ badge, title, lead, points, children }: Props) {
  return (
    <div className="h-full flex items-start justify-center pt-6">
      <Card className="w-full max-w-2xl p-8">
        <span className="inline-block text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--primary)]">
          {badge}
        </span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">{lead}</p>

        <ul className="mt-6 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
              />
              <span className="text-[var(--foreground)]/85">{p}</span>
            </li>
          ))}
        </ul>

        {children}
      </Card>
    </div>
  );
}
