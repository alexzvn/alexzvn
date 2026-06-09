import { useStore } from '@/store/timer';
import { Card } from '@jm/ui';
import { SectionHeader } from './ui/SectionHeader';
import { Input } from './ui/Input';
import { cn } from '@jm/ui';

export function AutoAdvanceSettings() {
  const autoAdvance = useStore((s) => s.timetable.autoAdvance);
  const grace = useStore((s) => s.timetable.autoAdvanceGraceSec);
  const setAutoAdvance = useStore((s) => s.ttSetAutoAdvance);
  const setGrace = useStore((s) => s.ttSetAutoAdvanceGrace);

  return (
    <Card variant="nested" className="w-full">
      <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <SectionHeader>Auto-Advance</SectionHeader>
          <p className="text-xs text-[var(--muted-foreground)] max-w-md">
            Springt automatisch zum nächsten Programmpunkt, wenn der aktuelle
            seine Zeit überschritten hat. Grace-Period sind Sekunden Overtime,
            die toleriert werden bevor der Sprung passiert.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-2">
              Grace · Sekunden
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value) || 0)}
              disabled={!autoAdvance}
              className="w-24 text-center font-extrabold"
            />
          </div>
          <button
            type="button"
            onClick={() => setAutoAdvance(!autoAdvance)}
            aria-pressed={autoAdvance}
            className={cn(
              'h-10 px-4 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
              'border transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
              autoAdvance
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
            )}
          >
            {autoAdvance ? 'Auto-Advance an' : 'Auto-Advance aus'}
          </button>
        </div>
      </div>
    </Card>
  );
}
