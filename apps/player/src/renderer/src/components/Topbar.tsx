import { useEffect, useState } from 'react';
import { Logo, cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
import type { Section } from '@/App';

interface NavItem {
  id: Section;
  label: string;
  hint: string;
}

const NAV: NavItem[] = [
  { id: 'library', label: 'Bibliothek', hint: 'Medien · Playlists' },
  { id: 'soundboard', label: 'Soundboard', hint: 'Sofort-Cues · Hotkeys' },
];

interface Props {
  section: Section;
  onSection: (section: Section) => void;
}

export function Topbar({ section, onSection }: Props) {
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

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm font-extrabold tracking-[0.06em]">JM PLAYER</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Player · Bibliothek · Soundboard
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1" style={noDragRegion}>
          {NAV.map((item) => (
            <NavButton
              key={item.id}
              label={item.label}
              hint={item.hint}
              active={section === item.id}
              onClick={() => onSection(item.id)}
            />
          ))}
        </nav>
      </div>

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

function NavButton({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
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
      <span className="hidden lg:inline text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
        {hint}
      </span>
    </button>
  );
}
