import { useEffect, useState } from 'react';
import { useSession } from '@/store/session';
import { useApp, type Section } from '@/store/app';
import { apiFetch } from '@/sync/client';
import { Logo } from '@jm/ui';
import { cn } from '@jm/ui';

interface NavItem {
  id: Section;
  label: string;
  hint?: string;
  comingSoon?: boolean;
}

const NAV: NavItem[] = [
  { id: 'video', label: 'Video', hint: 'TriCaster · PTZ · Kumo' },
  { id: 'audio', label: 'Audio', hint: 'Coming soon', comingSoon: true },
  { id: 'licht', label: 'Licht', hint: 'Coming soon', comingSoon: true },
  { id: 'setup', label: 'Setup', hint: 'Geräte · Benutzer' },
];

export function Topbar() {
  const section = useApp((s) => s.section);
  const setSection = useApp((s) => s.setSection);
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
        'relative h-16 flex items-center justify-between',
        'px-6 border-b border-[var(--border)]/60',
        'bg-[var(--card)]/60 backdrop-blur-md',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px
                   bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"
      />

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm font-extrabold tracking-[0.06em]">JM STUDIO</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Control
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <NavButton
              key={item.id}
              label={item.label}
              hint={item.hint}
              active={section === item.id}
              comingSoon={item.comingSoon}
              onClick={() => setSection(item.id)}
            />
          ))}
        </nav>
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

function NavButton({
  label,
  hint,
  active,
  comingSoon,
  onClick,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  comingSoon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative h-10 px-4 rounded-[var(--radius)] flex items-center gap-2',
        'text-sm font-bold transition-colors',
        active
          ? 'bg-[var(--highlight)] text-[var(--foreground)]'
          : 'text-[var(--foreground)]/75 hover:bg-[var(--highlight)] hover:text-[var(--foreground)]',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t bg-[var(--primary)]"
        />
      )}
      <span>{label}</span>
      {hint && (
        <span
          className={cn(
            'hidden lg:inline text-[10px] uppercase tracking-[0.12em] font-semibold',
            comingSoon ? 'text-[var(--muted-foreground)]/60' : 'text-[var(--muted-foreground)]',
          )}
        >
          {hint}
        </span>
      )}
    </button>
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
