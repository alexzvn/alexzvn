import { Badge, cn } from '@jm/ui';
import type { JmNdiSource } from '@shared/types';

interface Props {
  sources: JmNdiSource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function SourcePicker({ sources, selectedId, onSelect, disabled }: Props) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        Keine Quellen gefunden. Aktualisieren oder Bildschirmfreigabe erlauben.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {sources.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(s.id)}
          className={cn(
            'group flex flex-col gap-2 rounded-[var(--radius-lg)] border p-2 text-left transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            selectedId === s.id
              ? 'border-[var(--primary)] bg-[var(--highlight)]'
              : 'border-[var(--border)] hover:bg-[var(--highlight)]/50',
          )}
        >
          <div className="aspect-video w-full overflow-hidden rounded-[var(--radius)] bg-black">
            {s.thumbnailDataURL ? (
              <img src={s.thumbnailDataURL} alt="" className="h-full w-full object-contain" />
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            {s.appIconDataURL ? <img src={s.appIconDataURL} alt="" className="h-4 w-4 shrink-0" /> : null}
            <span className="truncate text-xs font-semibold" title={s.name}>
              {s.name}
            </span>
          </div>
          <Badge tone={s.type === 'screen' ? 'neutral' : 'muted'}>
            {s.type === 'screen' ? 'Monitor' : 'Fenster'}
          </Badge>
        </button>
      ))}
    </div>
  );
}
