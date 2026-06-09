import { useState, type DragEvent } from 'react';
import { cn } from '@jm/ui';
import { useProject } from '@/store/project';
import { SlideCanvas } from './SlideCanvas';

export function SlideList() {
  const slides = useProject((s) => s.doc.slides);
  const selectedId = useProject((s) => s.selectedId);
  const select = useProject((s) => s.select);
  const move = useProject((s) => s.move);
  const moveTo = useProject((s) => s.moveTo);
  const toggleHidden = useProject((s) => s.toggleHidden);
  const duplicate = useProject((s) => s.duplicate);
  const remove = useProject((s) => s.remove);
  const [dragId, setDragId] = useState<string | null>(null);

  const onDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragId) moveTo(dragId, targetIndex);
    setDragId(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-bold">
        Folien · {slides.length}
      </div>
      <div className="flex-1 overflow-auto scroll-thin px-2 pb-3 space-y-2">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            draggable
            onDragStart={() => setDragId(slide.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, index)}
            onClick={() => select(slide.id)}
            className={cn(
              'group relative rounded-lg border p-2 cursor-pointer transition-colors',
              selectedId === slide.id
                ? 'border-[var(--primary)] bg-[var(--highlight)]'
                : 'border-[var(--border)] hover:bg-[var(--highlight)]/60',
              slide.hidden && 'opacity-50',
            )}
          >
            <div className="flex gap-2">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] w-5 text-right tabular pt-0.5">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="aspect-video bg-black/40 rounded flex items-center justify-center overflow-hidden">
                  <SlideCanvas slide={slide} maxWidth={320} />
                </div>
                <div className="mt-1 text-xs font-semibold truncate">{slide.title || '—'}</div>
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <IconBtn title="Nach oben" onClick={(e) => { e.stopPropagation(); move(slide.id, -1); }}>↑</IconBtn>
              <IconBtn title="Nach unten" onClick={(e) => { e.stopPropagation(); move(slide.id, 1); }}>↓</IconBtn>
              <IconBtn
                title={slide.hidden ? 'Einblenden' : 'Ausblenden'}
                onClick={(e) => { e.stopPropagation(); toggleHidden(slide.id); }}
              >
                {slide.hidden ? '◌' : '👁'}
              </IconBtn>
              <IconBtn title="Duplizieren" onClick={(e) => { e.stopPropagation(); duplicate(slide.id); }}>⧉</IconBtn>
              <IconBtn
                title="Löschen"
                danger
                onClick={(e) => { e.stopPropagation(); remove(slide.id); }}
              >
                ✕
              </IconBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'h-6 w-6 rounded grid place-items-center text-xs',
        'hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)]',
        danger ? 'hover:text-[var(--destructive)]' : 'text-[var(--foreground)]/80',
      )}
    >
      {children}
    </button>
  );
}
