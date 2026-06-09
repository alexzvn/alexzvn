import { cn } from '../lib/cn';

interface Props {
  className?: string;
  size?: number;
  title?: string;
}

/**
 * Jakobs-Medien-Wortmarke ("JM") als Inline-SVG — kein Asset-Loader nötig,
 * damit das Logo aus jedem App-Bundle heraus funktioniert.
 */
export function Logo({ className, size = 28, title = 'Jakobs Medien' }: Props) {
  return (
    <svg
      role="img"
      aria-label={title}
      width={size}
      height={size}
      viewBox="0 0 2000 2000"
      className={cn('block select-none', className)}
      fill="var(--slash, #fbe73b)"
    >
      <path d="M610.72,489.47q-168.55,0-277.64-87.53C260.35,343.62,192.27,242.88,128.89,98.85l123.16-77.3H275.8c50.44,103.63,99.76,170.92,148,210.56S534.35,297.9,610.72,297.9H790.06L1568,282.41l-2.16-256.24L1581.12,5l155.81,11.24V498.1l-927.19-13Z" />
      <path d="M1672.31,1995l-28.1-415.52-64.8-620.82h-15.15l-356.51,898.16H1030.57L700,958.65H680.54L615.7,1560l-34.57,435h-188L537.91,613.21h255l64.84,201.66,265.76,731h17.27l280.91-737.52,64.84-195.18h252.81L1871.11,1995Z" />
      <path d="M1309,613.25v23.09L1162.49,957.78l-54.34.9-6.45-2.77L955.3,637.24v-24Z" />
    </svg>
  );
}
