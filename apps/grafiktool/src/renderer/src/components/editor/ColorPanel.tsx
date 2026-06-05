import { useEditor } from '@/store/editor';
import { hexToRgba } from '@/engine/color';
import { PanelLabel } from './controls';
import { cn } from '@jm/ui';

const PRESETS = [
  '#fbe73b', '#ffffff', '#000000', '#1a1a1a',
  '#e5484d', '#30a46c', '#0091ff', '#8e4ec6',
  '#f76808', '#ffc53d', '#9ca3af', '#00000000',
];

export function ColorPanel() {
  const controller = useEditor((s) => s.controller);
  const fg = useEditor((s) => s.foreground);
  const bg = useEditor((s) => s.background);
  if (!controller) return null;

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <PanelLabel>Farbe</PanelLabel>
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14">
          <SwatchInput
            color={bg}
            onChange={(hex) => controller.setBackground(hexToRgba(hex))}
            className="absolute right-0 bottom-0 w-9 h-9"
            title="Hintergrundfarbe"
          />
          <SwatchInput
            color={fg}
            onChange={(hex) => controller.setForeground(hexToRgba(hex))}
            className="absolute left-0 top-0 w-9 h-9 shadow-md"
            title="Vordergrundfarbe"
          />
        </div>
        <button
          type="button"
          title="Farben tauschen (X)"
          onClick={() => controller.swapColors()}
          className="h-7 px-2 rounded-[var(--radius)] border border-[var(--border)] text-[11px] font-bold
                     text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
        >
          Tauschen
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            title={p}
            onClick={() => controller.setForeground(hexToRgba(p.length > 7 ? '#000000' : p, p.length > 7 ? 0 : 255))}
            className="aspect-square rounded-[var(--radius-sm)] border border-[var(--border)]/70"
            style={{
              background:
                p === '#00000000'
                  ? 'repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 50% / 8px 8px'
                  : p,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SwatchInput({
  color,
  onChange,
  className,
  title,
}: {
  color: string;
  onChange: (hex: string) => void;
  className?: string;
  title?: string;
}) {
  return (
    <label
      title={title}
      className={cn('block rounded-[var(--radius)] border border-[var(--border)] overflow-hidden cursor-pointer', className)}
      style={{ background: color }}
    >
      <input
        type="color"
        value={color.length > 7 ? '#000000' : color}
        onChange={(e) => onChange(e.target.value)}
        className="opacity-0 w-full h-full cursor-pointer"
      />
    </label>
  );
}
