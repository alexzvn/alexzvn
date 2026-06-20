import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@jm/ui';
import { DSK_ENTRIES } from '@shared/tricaster';

interface Props {
  onExec: (shortcut: string) => void;
  disabled: boolean;
}

export function DskPanel({ onExec, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader>DSK · Downstream Keyer</SectionHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {DSK_ENTRIES.map((d) => (
          <div
            key={d.index}
            className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border)]/40 bg-[var(--card)]/40 p-3 gap-2"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
              {d.label}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="primary"
                disabled={disabled}
                onClick={() => onExec(d.autoShortcut)}
              >
                Auto
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onExec(d.takeShortcut)}
              >
                Take
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
