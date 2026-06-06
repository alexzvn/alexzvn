import { Toolbar } from '@/components/Toolbar';
import { SlideList } from '@/components/SlideList';
import { EditorStage } from '@/components/EditorStage';
import { Inspector } from '@/components/Inspector';
import { useProject } from '@/store/project';

export function EditorView() {
  const slides = useProject((s) => s.doc.slides);
  const selectedId = useProject((s) => s.selectedId);
  const error = useProject((s) => s.error);
  const setError = useProject((s) => s.setError);
  const importDocs = useProject((s) => s.importDocs);
  const importOffice = useProject((s) => s.importOffice);
  const selected = slides.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="h-full flex flex-col">
      <Toolbar />

      {error && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-[var(--destructive)]/15 border-b border-[var(--destructive)]/40 text-sm">
          <span className="text-[var(--destructive)]">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs opacity-70 hover:opacity-100">
            schließen
          </button>
        </div>
      )}

      {slides.length === 0 ? (
        <EmptyState onImport={() => void importDocs()} onOffice={() => void importOffice()} />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr_320px]">
          <aside className="border-r border-[var(--border)]/60 min-h-0">
            <SlideList />
          </aside>
          <section className="min-h-0 flex flex-col bg-[var(--background)]">
            {selected ? (
              <EditorStage slide={selected} />
            ) : (
              <div className="flex-1 grid place-items-center text-[var(--muted-foreground)] text-sm">
                Folie auswählen
              </div>
            )}
          </section>
          <aside className="border-l border-[var(--border)]/60 min-h-0">
            {selected && <Inspector slide={selected} />}
          </aside>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onImport, onOffice }: { onImport: () => void; onOffice: () => void }) {
  return (
    <div className="flex-1 grid place-items-center">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-4">🖥️</div>
        <h2 className="text-xl font-extrabold">Präsentation aufbauen</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
          Importiere PDFs, Bilder oder Office-Dokumente. Ordne die Folien neu, ergänze Titel,
          Notizen und Overlays — und präsentiere mit Referenten- und Publikumsansicht.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onImport}
            className="h-10 px-5 rounded-md bg-[var(--primary)] text-[var(--brand-dark)] font-bold"
          >
            PDF / Bilder importieren
          </button>
          <button
            type="button"
            onClick={onOffice}
            className="h-10 px-5 rounded-md border border-[var(--border)] bg-[var(--card)] font-semibold"
          >
            Office-Dokument
          </button>
        </div>
      </div>
    </div>
  );
}
