import { useStore } from '@/store/timer';
import { SectionHeader } from './ui/SectionHeader';
import { Card } from '@jm/ui';
import { Button } from '@jm/ui';
import { Input } from './ui/Input';
import { TimerDisplay } from './TimerDisplay';

const DEFAULTS = {
  normal: '#FFE819',
  warning: '#FFB81C',
  overtime: '#F61C56',
  warningAtSec: 60,
};

interface Row {
  key: keyof typeof DEFAULTS;
  label: string;
  description: string;
}

const ROWS: Row[] = [
  { key: 'normal',   label: 'Normal',   description: 'Solange genug Zeit bleibt.' },
  { key: 'warning',  label: 'Warning',  description: 'Wenn unter dem Schwellenwert.' },
  { key: 'overtime', label: 'Overtime', description: 'Wenn der Countdown abgelaufen ist.' },
];

export function ColorPicker() {
  const colors = useStore((s) => s.colors);
  const setColors = useStore((s) => s.setColors);

  return (
    <section className="flex flex-col h-full px-2 max-w-[960px]">
      <div className="pb-6">
        <SectionHeader>Timer Farben</SectionHeader>
      </div>

      <Card>
        <div className="p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Preview ms={5 * 60_000 + 30_000} label="Normal" />
            <Preview ms={30_000} label="Warning" />
            <Preview ms={-12_000} label="Overtime" />
          </div>

          <div className="h-px bg-[var(--border)]/60" />

          <div className="flex flex-col gap-4">
            {ROWS.map((row) => (
              <ColorRow
                key={row.key}
                label={row.label}
                description={row.description}
                value={colors[row.key] as string}
                onChange={(v) => setColors({ [row.key]: v } as Partial<typeof DEFAULTS>)}
              />
            ))}

            <div className="flex items-center justify-between gap-6">
              <div>
                <div className="text-sm font-semibold">Warning-Schwelle</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Sekunden, ab denen die Farbe auf Warning wechselt.
                </div>
              </div>
              <Input
                type="number"
                min={0}
                value={colors.warningAtSec}
                onChange={(e) => setColors({ warningAtSec: Number(e.target.value) || 0 })}
                className="w-32 text-right"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                uppercase={false}
                onClick={() => setColors(DEFAULTS)}
              >
                Auf JM-Defaults zurücksetzen
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function ColorRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-[var(--muted-foreground)]">{description}</div>
      </div>
      <div className="flex items-center gap-3">
        <label className="relative h-10 w-14 rounded-[var(--radius)] overflow-hidden border border-[var(--border)] cursor-pointer">
          <input
            type="color"
            value={normalizeHex(value)}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden
            className="block h-full w-full"
            style={{ background: value }}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 uppercase"
        />
      </div>
    </div>
  );
}

function Preview({ ms, label }: { ms: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--background)]/40 border border-[var(--border)]/40 overflow-hidden min-w-0">
      <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <TimerDisplay ms={ms} reactive size="preview" />
    </div>
  );
}

function normalizeHex(v: string): string {
  // <input type="color"> requires #RRGGBB
  if (/^#([0-9a-f]{6})$/i.test(v)) return v;
  if (/^#([0-9a-f]{3})$/i.test(v)) {
    return (
      '#' +
      v
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    );
  }
  return '#FFE819';
}
