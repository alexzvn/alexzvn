import { useEffect, useState } from 'react';
import { Logo, cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
import { useTools } from '@/store/tools';

export function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const openSettings = useTools((s) => s.openSettings);
  const openFeedback = useTools((s) => s.openFeedback);
  const version = useTools((s) => s.version);

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
        <Logo size={30} />
        <div className="flex flex-col leading-tight">
          <span className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-[0.06em]">JM PRODUCTION SUITE</span>
            {version && (
              <span
                title={`Launcher-Version ${version}`}
                className="rounded-[var(--radius-full)] border border-[var(--border)] px-1.5 py-px
                           text-[10px] font-bold tabular-nums text-[var(--muted-foreground)]"
              >
                v{version}
              </span>
            )}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Werkzeugkasten für Media Operators
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2" style={noDragRegion}>
        <button
          type="button"
          onClick={openFeedback}
          aria-label="Feedback senden"
          title="Bug melden / Funktion wünschen"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={openSettings}
          aria-label="Einstellungen"
          title="Einstellungen"
          className={cn(
            'grid place-items-center size-8 rounded-[var(--radius)]',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
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
      </div>
    </header>
  );
}
