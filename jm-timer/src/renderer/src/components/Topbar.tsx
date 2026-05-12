import { useEffect, useState } from 'react';
import { useStore } from '@/store/timer';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';

const MODE_LABELS: Record<string, string> = {
  clock: 'Real-Time Clock',
  countdown: 'Countdown',
  timetable: 'Timetable',
  settings: 'Timer Farben',
};

export function Topbar() {
  const mode = useStore((s) => s.mode);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <header
      className={cn(
        'relative h-14 flex items-center justify-between',
        'px-6 border-b border-[var(--border)]/60',
        'bg-[var(--card)]/60 backdrop-blur-md',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px
                   bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"
      />

      <div className="flex items-center gap-3">
        <Logo className="lg:hidden" size={22} />
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span className="text-[var(--slash)] mr-2">/</span>
          {MODE_LABELS[mode] ?? mode}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'h-8 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
          )}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
