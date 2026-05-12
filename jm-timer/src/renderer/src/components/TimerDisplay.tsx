import { useStore } from '@/store/timer';
import { formatHMS } from '@/lib/time';
import { cn } from '@/lib/cn';

interface Props {
  /** Milliseconds to display. Negative values render as -HH:MM:SS (overtime). */
  ms: number;
  /** Color shifts to warning/overtime when true (Countdown). Off for wall-clock. */
  reactive?: boolean;
  className?: string;
  /** override the size (CSS clamp by default) */
  size?: 'fit' | 'fullscreen';
}

export function TimerDisplay({ ms, reactive = true, className, size = 'fit' }: Props) {
  const colors = useStore((s) => s.colors);

  let color: string = colors.normal;
  if (reactive) {
    if (ms <= 0) color = colors.overtime;
    else if (ms <= colors.warningAtSec * 1000) color = colors.warning;
  }

  const fontSize =
    size === 'fullscreen'
      ? 'clamp(6rem, 22vw, 26rem)'
      : 'clamp(3rem, 14vw, 14rem)';

  return (
    <div
      className={cn(
        'font-extrabold leading-none tabular tracking-tight select-none',
        className,
      )}
      style={{ color, fontSize }}
    >
      {formatHMS(ms)}
    </div>
  );
}
