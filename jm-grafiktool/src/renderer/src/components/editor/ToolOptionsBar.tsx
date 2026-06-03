import { useEditor } from '@/store/editor';
import type { ShapeKind } from '@/engine/types';
import { Toggle, Segment } from './controls';
import { cn } from '@/lib/cn';

/** A compact inline number slider for the horizontal options bar. */
function Inline({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-[var(--muted-foreground)] whitespace-nowrap">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 accent-[var(--primary)] cursor-pointer"
      />
      <span className="text-[11px] tabular w-9 text-[var(--foreground)]/80">
        {Math.round(value)}
        {unit}
      </span>
    </label>
  );
}

export function ToolOptionsBar() {
  const controller = useEditor((s) => s.controller);
  const toolId = useEditor((s) => s.toolId);
  const brush = useEditor((s) => s.brush);
  const options = useEditor((s) => s.options);
  const zoom = useEditor((s) => s.zoom);
  const showSafe = useEditor((s) => s.showSafeArea);
  if (!controller) return null;

  return (
    <div className="h-10 shrink-0 border-b border-[var(--border)]/50 bg-[var(--card)]/40 px-3 flex items-center gap-4 overflow-x-auto">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {(toolId === 'brush' || toolId === 'eraser') && (
          <>
            <Inline label="Größe" value={brush.size} min={1} max={400} unit="px" onChange={(v) => controller.setBrush({ size: v })} />
            <Inline label="Härte" value={brush.hardness * 100} min={0} max={100} unit="%" onChange={(v) => controller.setBrush({ hardness: v / 100 })} />
            <Inline label="Deckkraft" value={brush.opacity * 100} min={1} max={100} unit="%" onChange={(v) => controller.setBrush({ opacity: v / 100 })} />
          </>
        )}
        {(toolId === 'fill' || toolId === 'wand') && (
          <>
            <Inline label="Toleranz" value={options.tolerance} min={0} max={150} onChange={(v) => controller.setOptions({ tolerance: v })} />
            <Toggle label="Zusammenhängend" checked={options.contiguous} onChange={(v) => controller.setOptions({ contiguous: v })} />
          </>
        )}
        {toolId === 'shape' && (
          <>
            <Segment<ShapeKind>
              value={options.shapeKind}
              onChange={(v) => controller.setOptions({ shapeKind: v })}
              options={[
                { value: 'rectangle', label: 'Rechteck' },
                { value: 'ellipse', label: 'Ellipse' },
                { value: 'line', label: 'Linie' },
              ]}
            />
            <Toggle label="Füllung" checked={options.shapeFill} onChange={(v) => controller.setOptions({ shapeFill: v })} />
            <Toggle label="Kontur" checked={options.shapeStroke} onChange={(v) => controller.setOptions({ shapeStroke: v })} />
            {(options.shapeStroke || options.shapeKind === 'line') && (
              <Inline label="Stärke" value={options.shapeStrokeWidth} min={1} max={80} unit="px" onChange={(v) => controller.setOptions({ shapeStrokeWidth: v })} />
            )}
          </>
        )}
        {toolId === 'text' && (
          <span className="text-[11px] text-[var(--muted-foreground)]">Klicken zum Platzieren · Eigenschaften rechts</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Toggle label="Safe-Area" checked={showSafe} onChange={() => controller.toggleSafeArea()} />
        <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
          <ZoomBtn onClick={() => controller.zoomOut()}>−</ZoomBtn>
          <button
            type="button"
            onClick={() => controller.fitView()}
            title="Einpassen"
            className="h-7 px-2 text-[11px] tabular font-bold text-[var(--foreground)]/80 hover:bg-[var(--highlight)] min-w-[3rem]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ZoomBtn onClick={() => controller.zoomIn()}>+</ZoomBtn>
        </div>
        <button
          type="button"
          onClick={() => controller.actualPixels()}
          className="h-7 px-2 rounded-[var(--radius)] border border-[var(--border)] text-[11px] font-bold text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
        >
          100%
        </button>
      </div>
    </div>
  );
}

function ZoomBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-7 w-7 grid place-items-center text-[var(--foreground)]/80 hover:bg-[var(--highlight)] font-bold')}
    >
      {children}
    </button>
  );
}
