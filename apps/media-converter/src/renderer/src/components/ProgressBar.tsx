import { cn } from '@jm/ui';

interface Props {
  /** 0..100, or negative for indeterminate. */
  percent: number;
  tone?: 'primary' | 'muted' | 'destructive';
}

export function ProgressBar({ percent, tone = 'primary' }: Props) {
  const indeterminate = percent < 0;
  const color =
    tone === 'destructive'
      ? 'var(--destructive)'
      : tone === 'muted'
        ? 'var(--muted-foreground)'
        : 'var(--primary)';

  return (
    <div className="h-2 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--secondary)]">
      <div
        className={cn('h-full rounded-[var(--radius-full)]', indeterminate && 'jmc-indeterminate')}
        style={{
          width: indeterminate ? '40%' : `${Math.min(100, Math.max(0, percent))}%`,
          background: color,
          transition: indeterminate ? undefined : 'width 0.2s linear',
        }}
      />
    </div>
  );
}
