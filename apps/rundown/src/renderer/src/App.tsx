import { useEffect, useState } from 'react';
import { useRundown } from '@/store/useRundown';
import { ToolLinks } from '@/components/ToolLinks';
import { Transport } from '@/components/Transport';
import { RundownList } from '@/components/RundownList';
import { RowEditor } from '@/components/RowEditor';
import { ConnectionsPanel } from '@/components/ConnectionsPanel';

const hdrBtn =
  'rounded-md border border-neutral-700 px-2.5 py-1 text-neutral-300 hover:bg-neutral-800';

export function App() {
  const { state, load, nav, setDoc, newDoc, open, save, saveAs, setEndpoint } = useRundown();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConnections, setShowConnections] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  // Tastatur-Regie: Leertaste = GO, Pfeil hoch/runter = Zurück/Weiter
  // (nur außerhalb von Eingabefeldern, damit das Tippen nicht stört).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        void nav({ t: 'go' });
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        void nav({ t: 'next' });
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        void nav({ t: 'prev' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  if (!state) {
    return <div className="grid h-full place-items-center text-neutral-500">Lädt …</div>;
  }

  const selectedRow =
    state.doc.rows.find((r) => r.id === selectedId) ?? state.doc.rows[state.index] ?? null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="font-bold">JM Rundown</span>
        <input
          key={`${state.doc.name}|${state.filePath ?? ''}`}
          defaultValue={state.doc.name}
          onBlur={(e) => void setDoc({ ...state.doc, name: e.target.value })}
          className="rounded border border-transparent bg-transparent px-2 py-0.5 text-sm hover:border-neutral-700 focus:border-neutral-600 focus:outline-none"
        />
        {state.dirty && <span className="text-xs text-[var(--brand-yellow)]">• ungespeichert</span>}
        <div className="ml-auto flex items-center gap-1.5 text-sm">
          <button onClick={() => void newDoc()} className={hdrBtn}>
            Neu
          </button>
          <button onClick={() => void open()} className={hdrBtn}>
            Öffnen
          </button>
          <button onClick={() => void save()} className={hdrBtn}>
            Speichern
          </button>
          <button onClick={() => void saveAs()} className={hdrBtn}>
            Speichern unter …
          </button>
        </div>
      </header>

      <ToolLinks links={state.links} onOpenConnections={() => setShowConnections(true)} />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 border-r border-neutral-800">
          <RundownList
            doc={state.doc}
            index={state.index}
            selectedId={selectedRow?.id ?? null}
            onSelect={setSelectedId}
            onSetCue={(i) => void nav({ t: 'goto', n: i + 1 })}
            onDoc={(d) => void setDoc(d)}
          />
        </div>
        <div className="w-[26rem] shrink-0">
          {selectedRow ? (
            <RowEditor doc={state.doc} row={selectedRow} onDoc={(d) => void setDoc(d)} />
          ) : (
            <div className="grid h-full place-items-center text-sm text-neutral-500">
              Keine Zeile gewählt.
            </div>
          )}
        </div>
      </div>

      <Transport state={state} onNav={(cmd) => void nav(cmd)} />

      {showConnections && (
        <ConnectionsPanel
          links={state.links}
          overrides={state.overrides}
          onSet={(role, host, port) => void setEndpoint(role, host, port)}
          onClose={() => setShowConnections(false)}
        />
      )}
    </div>
  );
}
