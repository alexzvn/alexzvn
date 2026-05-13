import { useApp, type Section } from '@/store/app';
import { useSession } from '@/store/session';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';

interface Item {
  id: Section;
  label: string;
  hint?: string;
  comingSoon?: boolean;
}

const ITEMS: Item[] = [
  { id: 'video', label: 'Video', hint: 'TriCaster · PTZ · Kumo' },
  { id: 'audio', label: 'Audio', hint: 'Coming soon', comingSoon: true },
  { id: 'licht', label: 'Licht', hint: 'Coming soon', comingSoon: true },
  { id: 'setup', label: 'Setup', hint: 'Geräte · Benutzer' },
];

export function Sidebar() {
  const section = useApp((s) => s.section);
  const setSection = useApp((s) => s.setSection);
  const user = useSession((s) => s.user);

  return (
    <aside className="hidden lg:flex w-[220px] flex-col bg-[var(--sidebar)] border-r border-[var(--border)]/60">
      <div className="h-14 flex items-center gap-3 px-5 border-b border-[var(--border)]/60">
        <Logo size={26} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-[0.06em]">JM STUDIO</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Control
          </span>
        </div>
      </div>

      <nav className="flex flex-col p-3 gap-1">
        <div className="px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span className="text-[var(--slash)] mr-2">/</span>Bereiche
        </div>
        {ITEMS.map((item) => (
          <NavItem
            key={item.id}
            label={item.label}
            hint={item.hint}
            active={section === item.id}
            comingSoon={item.comingSoon}
            onClick={() => setSection(item.id)}
          />
        ))}
      </nav>

      <div className="mt-auto px-5 py-4 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {user ? (
          <span>
            {user.username} · <span className="text-[var(--primary)]">{user.role}</span>
          </span>
        ) : (
          <span>v0.1.0</span>
        )}
      </div>
    </aside>
  );
}

function NavItem({
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
        'relative w-full text-left rounded-[var(--radius)]',
        'px-3 py-2.5 flex items-center justify-between',
        'transition-colors',
        active
          ? 'bg-[var(--highlight)] text-[var(--foreground)]'
          : 'text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-[var(--primary)]"
        />
      )}
      <span className="text-sm font-semibold">{label}</span>
      {hint && (
        <span
          className={cn(
            'text-[10px] uppercase tracking-[0.12em]',
            comingSoon ? 'text-[var(--muted-foreground)]/60' : 'text-[var(--muted-foreground)]',
          )}
        >
          {hint}
        </span>
      )}
    </button>
  );
}
