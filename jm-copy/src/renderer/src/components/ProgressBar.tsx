import { cn } from '@/lib/cn';

interface Props {
  /** 0..1 */
  value?: number;
  indeterminate?: boolean;
  className?: string;
  tone?: 'primary' | 'success' | 'error';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  primary: 'bg-[var(--primary)]',
  success: 'bg-[var(--primary)]',
  error: 'bg-[var(--destructive)]',
};

export function ProgressBar({ value = 0, indeterminate, className, tone = 'primary' }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]',
        className,
      )}
    >
      {indeterminate ? (
        <div className={cn('jm-indeterminate absolute inset-y-0 w-1/3 rounded-full', TONE[tone])} />
      ) : (
        <div
          className={cn('h-full rounded-full transition-[width] duration-150', TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
