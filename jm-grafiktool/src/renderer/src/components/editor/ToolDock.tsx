import type { ToolId } from '@/engine/types';
import { useEditor } from '@/store/editor';
import { TOOL_ICONS } from './Icons';
import { cn } from '@/lib/cn';

interface ToolDef {
  id: ToolId;
  label: string;
  key: string;
}

const TOOLS: ToolDef[] = [
  { id: 'transform', label: 'Transformieren · Skalieren / Drehen', key: 'Strg+T' },
  { id: 'move', label: 'Verschieben', key: 'V' },
  { id: 'brush', label: 'Pinsel', key: 'B' },
  { id: 'eraser', label: 'Radierer', key: 'E' },
  { id: 'fill', label: 'Füllen (Farbfläche)', key: 'G' },
  { id: 'marquee', label: 'Auswahl Rechteck', key: 'M' },
  { id: 'lasso', label: 'Lasso', key: 'L' },
  { id: 'wand', label: 'Zauberstab', key: 'W' },
  { id: 'shape', label: 'Form', key: 'U' },
  { id: 'text', label: 'Text', key: 'T' },
  { id: 'crop', label: 'Freistellen / Crop', key: 'C' },
  { id: 'eyedropper', label: 'Pipette', key: 'I' },
  { id: 'hand', label: 'Hand (Leertaste)', key: 'H' },
  { id: 'zoom', label: 'Zoom', key: 'Z' },
];

export function ToolDock() {
  const controller = useEditor((s) => s.controller);
  const toolId = useEditor((s) => s.toolId);

  return (
    <aside className="w-12 shrink-0 border-r border-[var(--border)]/60 bg-[var(--sidebar)] flex flex-col items-center gap-0.5 py-2">
      {TOOLS.map((t) => {
        const Ico = TOOL_ICONS[t.id];
        const active = toolId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={`${t.label} · ${t.key}`}
            onClick={() => controller?.setTool(t.id)}
            className={cn(
              'relative w-9 h-9 rounded-[var(--radius)] grid place-items-center transition-colors',
              active
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--foreground)]/70 hover:bg-[var(--highlight)] hover:text-[var(--foreground)]',
            )}
          >
            <Ico size={18} />
          </button>
        );
      })}
    </aside>
  );
}
