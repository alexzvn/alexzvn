import { useEffect, useState } from 'react';
import { useStore, type TimetableItem } from '@/store/timer';
import { formatHMS, parseHMS } from '@/lib/time';
import { Input } from './ui/Input';
import { Button } from '@jm/ui';
import { StatusPill } from './ui/StatusPill';
import { cn } from '@jm/ui';

interface Props {
  item: TimetableItem;
  index: number;
  total: number;
  status: 'past' | 'active' | 'upcoming';
  /** projected wall-clock start time, ms, or null when not projectable */
  projectedStartMs: number | null;
}

export function TimetableRow({ item, index, total, status, projectedStartMs }: Props) {
  const ttUpdate = useStore((s) => s.ttUpdate);
  const ttDelete = useStore((s) => s.ttDelete);
  const ttMove = useStore((s) => s.ttMove);
  const ttLoadItem = useStore((s) => s.ttLoadItem);

  const [label, setLabel] = useState(item.label);
  const [durationDraft, setDurationDraft] = useState(formatHMS(item.durationMs));
  const [note, setNote] = useState(item.note ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLabel(item.label), [item.label]);
  useEffect(() => setDurationDraft(formatHMS(item.durationMs)), [item.durationMs]);
  useEffect(() => setNote(item.note ?? ''), [item.note]);

  function commitLabel() {
    if (label.trim() !== item.label) ttUpdate(item.id, { label: label.trim() });
  }
  function commitDuration() {
    const ms = parseHMS(durationDraft);
    if (ms === null) {
      setError('HH:MM:SS');
      return;
    }
    setError(null);
    if (ms !== item.durationMs) ttUpdate(item.id, { durationMs: ms });
  }
  function commitNote() {
    if (note !== (item.note ?? '')) ttUpdate(item.id, { note: note.trim() || undefined });
  }

  return (
    <div
      className={cn(
        'grid grid-cols-[36px_minmax(0,1fr)_120px_minmax(0,1fr)_88px_136px] items-center gap-3 px-4 py-3 rounded-[var(--radius-md)]',
        'border transition-colors',
        status === 'active'
          ? 'bg-[var(--highlight)] border-[var(--primary)]/40'
          : 'bg-[var(--card)]/40 border-[var(--border)]/40 hover:bg-[var(--card)]/70',
        status === 'past' && 'opacity-50',
      )}
    >
      <div className="text-xs tabular tracking-[0.12em] text-[var(--muted-foreground)] text-center font-extrabold">
        {String(index + 1).padStart(2, '0')}
      </div>

      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        placeholder="Programmpunkt"
        className="font-semibold"
      />

      <div className="flex flex-col">
        <Input
          value={durationDraft}
          onChange={(e) => setDurationDraft(e.target.value)}
          onBlur={commitDuration}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="00:05:00"
          className="text-center"
        />
        {error && (
          <span className="text-[10px] text-[var(--destructive)] mt-1 text-center">{error}</span>
        )}
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={commitNote}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        placeholder="Notiz"
        className="text-sm"
      />

      <div className="text-xs text-center text-[var(--muted-foreground)] tabular">
        {status === 'active' ? (
          <StatusPill status="live">Live</StatusPill>
        ) : status === 'past' ? (
          <StatusPill status="done">Done</StatusPill>
        ) : projectedStartMs !== null ? (
          <span className="tracking-wide">
            {formatWallClock(projectedStartMs)}
          </span>
        ) : (
          <span className="text-[var(--muted-foreground)]">—</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-1">
        <IconButton
          title="Nach oben"
          disabled={index === 0}
          onClick={() => ttMove(item.id, 'up')}
        >
          ↑
        </IconButton>
        <IconButton
          title="Nach unten"
          disabled={index === total - 1}
          onClick={() => ttMove(item.id, 'down')}
        >
          ↓
        </IconButton>
        <Button
          variant="ghost"
          size="sm"
          uppercase={false}
          onClick={() => ttLoadItem(index)}
          className="!h-8 !px-2 text-xs"
        >
          Load
        </Button>
        <IconButton title="Löschen" onClick={() => ttDelete(item.id)} destructive>
          ✕
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-8 w-8 rounded-[var(--radius)] inline-flex items-center justify-center',
        'text-sm font-bold transition-colors',
        'border border-transparent',
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : destructive
            ? 'text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10'
            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--highlight)]',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
      )}
    >
      {children}
    </button>
  );
}

function formatWallClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
