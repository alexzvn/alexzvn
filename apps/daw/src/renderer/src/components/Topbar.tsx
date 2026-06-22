import { Logo, cn, dragRegion, noDragRegion, isElectronMac } from '@jm/ui';
import { useProject } from '@/store/project';
import { openProjectFlow, saveProjectFlow } from '@/lib/actions';

interface Props {
  onExport: () => void;
}

export function Topbar({ onExport }: Props) {
  const name = useProject((s) => s.present.name);
  const dirty = useProject((s) => s.dirty);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  const undo = useProject((s) => s.undo);
  const redo = useProject((s) => s.redo);
  const newProject = useProject((s) => s.newProject);

  return (
    <header
      style={dragRegion}
      className={cn(
        'relative h-14 flex items-center justify-between shrink-0',
        'pr-4 border-b border-[var(--border)]/60 bg-[var(--card)]/60 backdrop-blur-md',
        isElectronMac ? 'pl-20' : 'pl-4',
      )}
    >
      <div className="flex items-center gap-4" style={noDragRegion}>
        <div className="flex items-center gap-2.5">
          <Logo size={24} />
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm font-extrabold tracking-[0.06em]">JM DAW</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Audio-Workstation
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <TbButton label="Neu" onClick={newProject} />
          <TbButton label="Öffnen" onClick={() => void openProjectFlow()} />
          <TbButton label="Speichern" onClick={() => void saveProjectFlow(false)} />
          <TbButton label="Speichern unter" onClick={() => void saveProjectFlow(true)} />
        </div>

        <div className="flex items-center gap-1">
          <TbButton label="↶ Rückgängig" onClick={undo} disabled={!canUndo} />
          <TbButton label="↷ Wiederherstellen" onClick={redo} disabled={!canRedo} />
        </div>
      </div>

      <div className="flex items-center gap-4" style={noDragRegion}>
        <span className="text-xs text-[var(--muted-foreground)] max-w-[260px] truncate">
          {name}
          {dirty ? ' •' : ''}
        </span>
        <button
          type="button"
          onClick={onExport}
          className={cn(
            'h-9 px-4 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity',
          )}
        >
          Exportieren
        </button>
      </div>
    </header>
  );
}

function TbButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 px-2.5 rounded-[var(--radius)] text-xs font-bold transition-colors whitespace-nowrap',
        'text-[var(--foreground)]/80 hover:bg-[var(--highlight)] hover:text-[var(--foreground)]',
        'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent',
      )}
    >
      {label}
    </button>
  );
}
