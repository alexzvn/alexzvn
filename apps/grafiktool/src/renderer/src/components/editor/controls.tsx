import { useRef } from 'react';
import { cn } from '@jm/ui';

export function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
      {children}
    </span>
  );
}

interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onCommitStart?: () => void;
  onCommitEnd?: () => void;
}

export function Slider({ label, value, min, max, step = 1, unit, onChange, onCommitStart, onCommitEnd }: SliderProps) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="flex items-center justify-between">
          <PanelLabel>{label}</PanelLabel>
          <span className="text-[11px] tabular text-[var(--foreground)]/80">
            {Math.round(value)}
            {unit}
          </span>
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onCommitStart}
        onPointerUp={onCommitEnd}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)] cursor-pointer"
      />
    </label>
  );
}

interface SwatchProps {
  color: string;
  onChange: (hex: string) => void;
  size?: number;
  title?: string;
}

export function Swatch({ color, onChange, size = 28, title }: SwatchProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      title={title}
      onClick={() => ref.current?.click()}
      className="relative rounded-[var(--radius)] border border-[var(--border)] overflow-hidden"
      style={{ width: size, height: size, background: color }}
    >
      <input
        ref={ref}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'h-7 px-2.5 rounded-[var(--radius)] text-[11px] font-bold border transition-colors',
        checked
          ? 'bg-[var(--highlight)] border-[var(--primary)]/60 text-[var(--foreground)]'
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}

interface SegmentProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function Segment<T extends string>({ value, options, onChange }: SegmentProps<T>) {
  return (
    <div className="inline-flex rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 px-2.5 text-[11px] font-bold transition-colors',
            value === o.value
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'text-[var(--foreground)]/75 hover:bg-[var(--highlight)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
