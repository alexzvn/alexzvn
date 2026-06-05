import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@jm/ui';
import { DDR_ENTRIES } from '@shared/tricaster';

interface Props {
  onExec: (shortcut: string) => void;
  disabled: boolean;
}

export function DdrPanel({ onExec, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader>DDR · Mediaplayer</SectionHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        {DDR_ENTRIES.map((d) => (
          <div
            key={d.index}
            className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border)]/40 bg-[var(--card)]/40 p-3 gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
                {d.label}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onExec(d.shortcuts.prev)}
                  className="h-7 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] hover:bg-[var(--highlight)] disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Vorheriger Clip"
                >
                  ◀◀
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onExec(d.shortcuts.next)}
                  className="h-7 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] hover:bg-[var(--highlight)] disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Nächster Clip"
                >
                  ▶▶
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                size="sm"
                variant="primary"
                disabled={disabled}
                onClick={() => onExec(d.shortcuts.play)}
                title="Play"
              >
                ▶
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onExec(d.shortcuts.pause)}
                title="Pause"
              >
                ❚❚
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onExec(d.shortcuts.stop)}
                title="Stop"
              >
                ■
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
