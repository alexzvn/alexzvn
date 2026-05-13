import { useEffect, useState } from 'react';
import { useSession } from '@/store/session';
import { useApp } from '@/store/app';
import { apiFetch } from '@/sync/client';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';

const SECTION_LABELS: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  licht: 'Licht',
  setup: 'Setup',
};

export function Topbar() {
  const section = useApp((s) => s.section);
  const connected = useSession((s) => s.connected);
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);
  const clearSession = useSession((s) => s.clearSession);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  async function logout(): Promise<void> {
    try {
      await apiFetch('/api/logout', { method: 'POST', token });
    } catch {
      // ignore network error — clear anyway
    }
    clearSession();
  }

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
          {SECTION_LABELS[section] ?? section}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <SyncPill connected={connected} />
        {user && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hidden md:inline">
            {user.username} · <span className="text-[var(--primary)]">{user.role}</span>
          </span>
        )}
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
        <button
          type="button"
          onClick={logout}
          className={cn(
            'h-8 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'border border-[var(--border)] text-[var(--foreground)]',
            'hover:bg-[var(--highlight)] transition-colors',
          )}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function SyncPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 h-6',
        'text-[10px] uppercase tracking-[0.14em] font-extrabold border',
        connected
          ? 'border-[var(--primary)]/40 text-[var(--primary)]'
          : 'border-[var(--destructive)]/60 text-[var(--destructive)]',
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: connected ? 'var(--primary)' : 'var(--destructive)' }}
      />
      {connected ? 'Sync' : 'Offline'}
    </span>
  );
}
