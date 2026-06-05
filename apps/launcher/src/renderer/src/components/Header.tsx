import { useEffect, useState } from 'react';
import { Logo, cn } from '@jm/ui';

export function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <header
      className={cn(
        'relative h-16 flex items-center justify-between shrink-0',
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
        <Logo size={30} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-[0.06em]">JM PRODUCTION SUITE</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Werkzeugkasten für Media Operators
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={cn(
          'h-8 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
          'border border-[var(--border)] text-[var(--foreground)]',
          'hover:bg-[var(--highlight)] transition-colors',
        )}
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </header>
  );
}
