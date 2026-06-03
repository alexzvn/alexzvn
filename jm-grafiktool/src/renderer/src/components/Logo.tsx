import logoUrl from '@/assets/jm-logo.svg';
import { cn } from '@/lib/cn';

interface Props {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 28 }: Props) {
  return (
    <img
      src={logoUrl}
      alt="Jakobs Medien"
      width={size}
      height={size}
      className={cn('block select-none', className)}
      draggable={false}
    />
  );
}
