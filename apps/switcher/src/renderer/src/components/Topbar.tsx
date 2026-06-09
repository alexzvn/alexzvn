import { useEffect, useState } from 'react';
import { Logo, cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';

export type SwitcherTab = 'switcher' | 'settings';

const TABS: { key: SwitcherTab; label: string }[] = [
  { key: 'switcher', label: 'Mischer' },
  { key: 'settings', label: 'Einstellungen' },
];

export function Topbar({ tab, onTab }: { tab: SwitcherTab; onTab: (t: SwitcherTab) => void }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <header
      style={dragRegion}
      className={cn(
        'relative h-16 flex items-center justify-between shrink-0',
        'pr-6 border-b border-[var(--border)]/60',
        isElectronMac ? 'pl-20' : 'pl-6',
        'bg-[var(--card)]/60 backdrop-blur-md',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px
                   bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"
      />

      <div className="flex items-center gap-3">
        <Logo size={28} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-[0.06em]">JM SWITCHER</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Video-Mischer · Program / Preview
          </span>
        </div>
      </div>

      <nav style={noDragRegion} className="flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTab(t.key)}
            className={cn(
              'h-8 px-3.5 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold transition-colors',
              tab === t.key
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--highlight)] hover:text-[var(--foreground)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <button
        type="button"
        style={noDragRegion}
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
