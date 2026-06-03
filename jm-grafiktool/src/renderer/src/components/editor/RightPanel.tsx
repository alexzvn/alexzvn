import { useEffect, useRef, useState } from 'react';
import { useActiveLayer, useEditor } from '@/store/editor';
import { ColorPanel } from './ColorPanel';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { cn } from '@/lib/cn';

type Tab = 'layers' | 'color' | 'props';

const TABS: { id: Tab; label: string }[] = [
  { id: 'layers', label: 'Ebenen' },
  { id: 'color', label: 'Farbe' },
  { id: 'props', label: 'Eigenschaften' },
];

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('layers');
  const active = useActiveLayer();
  const fg = useEditor((s) => s.foreground);
  const prevActive = useRef<string | null>(null);

  // When a text/shape layer becomes active, jump to its properties.
  useEffect(() => {
    if (active && active.id !== prevActive.current && (active.kind === 'text' || active.kind === 'shape')) {
      setTab('props');
    }
    prevActive.current = active?.id ?? null;
  }, [active]);

  return (
    <aside className="w-72 shrink-0 border-l border-[var(--border)]/60 bg-[var(--card)]/40 flex flex-col">
      <div className="h-10 shrink-0 flex items-stretch border-b border-[var(--border)]/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex-1 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors',
              tab === t.id
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]/80',
            )}
          >
            {t.label}
            {tab === t.id && (
              <span aria-hidden className="absolute left-3 right-3 -bottom-px h-[2px] rounded-t bg-[var(--primary)]" />
            )}
          </button>
        ))}
        {/* Always-visible foreground color chip so it's reachable from any tab. */}
        <div
          aria-hidden
          title="Vordergrundfarbe"
          className="self-center mr-2 w-5 h-5 rounded-[var(--radius-sm)] border border-[var(--border)]"
          style={{ background: fg }}
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === 'layers' && <LayersPanel />}
        {tab === 'color' && (
          <div className="flex-1 min-h-0 overflow-auto">
            <ColorPanel />
          </div>
        )}
        {tab === 'props' && (
          <div className="flex-1 min-h-0 overflow-auto">
            <PropertiesPanel />
          </div>
        )}
      </div>
    </aside>
  );
}
