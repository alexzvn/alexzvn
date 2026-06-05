import { useStore, type Mode } from '@/store/timer';
import { Logo } from '@jm/ui';
import { cn } from '@jm/ui';

interface Item {
  id: Mode;
  label: string;
  hint?: string;
  disabled?: boolean;
}

const ITEMS: Item[] = [
  { id: 'clock',     label: 'Clock',     hint: 'Real-Time' },
  { id: 'countdown', label: 'Countdown', hint: 'HH:MM:SS' },
  { id: 'timetable', label: 'Timetable', hint: 'Regieplan' },
  { id: 'remote',    label: 'Remote',    hint: 'LAN' },
  { id: 'settings',  label: 'Farben',    hint: 'Timer-States' },
];

export function Sidebar() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  return (
    <aside className="hidden lg:flex w-[220px] flex-col bg-[var(--sidebar)] border-r border-[var(--border)]/60">
      <div className="h-14 flex items-center gap-3 px-5 border-b border-[var(--border)]/60">
        <Logo size={26} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-[0.06em]">JM TIMER</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Live Production
          </span>
        </div>
      </div>

      <nav className="flex flex-col p-3 gap-1">
        <div className="px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span className="text-[var(--slash)] mr-2">/</span>Modi
        </div>
        {ITEMS.map((item) => (
          <NavItem
            key={item.id}
            label={item.label}
            hint={item.hint}
            active={mode === item.id}
            disabled={item.disabled}
            onClick={() => !item.disabled && setMode(item.id)}
          />
        ))}
      </nav>

      <div className="mt-auto px-5 py-4 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        v0.1.0
      </div>
    </aside>
  );
}

function NavItem({
  label,
  hint,
  active,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative w-full text-left rounded-[var(--radius)]',
        'px-3 py-2.5 flex items-center justify-between',
        'transition-colors',
        active
          ? 'bg-[var(--highlight)] text-[var(--foreground)]'
          : 'text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
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
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {hint}
        </span>
      )}
    </button>
  );
}
