import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';
import type { Section } from '@/App';

interface NavItem {
  id: Section;
  label: string;
  hint: string;
}

const NAV: NavItem[] = [
  { id: 'copy', label: 'Kopieren', hint: 'Offload · Verify · MHL' },
  { id: 'templates', label: 'Vorlagen', hint: 'Master-Ordner Baukasten' },
  { id: 'verify', label: 'Prüfen', hint: 'Ordner gegen MHL' },
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
            <span className="text-sm font-extrabold tracking-[0.06em]">JM COPY</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Verifizierter Offload
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
              onClick={() => onSection(item.id)}
            />
          ))}
        </nav>
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
