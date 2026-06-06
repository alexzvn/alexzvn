import { useEffect, useState } from 'react';
import { Logo, cn } from '@jm/ui';
import type { DisplayInfo, PresentationState } from '@shared/types';
import { useProject } from '@/store/project';

const btn =
  'h-9 px-3 rounded-md text-sm font-semibold whitespace-nowrap border border-[var(--border)] bg-[var(--card)] ' +
  'hover:bg-[var(--highlight)] transition-colors disabled:opacity-40 disabled:pointer-events-none';

export function Toolbar() {
  const doc = useProject((s) => s.doc);
  const busy = useProject((s) => s.busy);
  const dirty = useProject((s) => s.dirty);
  const selectedId = useProject((s) => s.selectedId);
  const importDocs = useProject((s) => s.importDocs);
  const importOffice = useProject((s) => s.importOffice);
  const openProject = useProject((s) => s.openProject);
  const saveProject = useProject((s) => s.saveProject);
  const exportPdf = useProject((s) => s.exportPdf);
  const buildPayload = useProject((s) => s.buildPayload);
  const setError = useProject((s) => s.setError);

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [audienceDisplay, setAudienceDisplay] = useState<number | null>(null);
  const [present, setPresent] = useState<PresentationState>({
    active: false,
    index: 0,
    total: 0,
    screen: 'live',
  });

  useEffect(() => {
    void window.jmpr.present.displays().then((d) => {
      setDisplays(d);
      // Default the audience to a non-primary screen when present.
      const secondary = d.find((x) => !x.primary);
      setAudienceDisplay(secondary?.id ?? d[0]?.id ?? null);
    });
    void window.jmpr.present.getState().then(setPresent);
    return window.jmpr.present.onState(setPresent);
  }, []);

  const visibleCount = doc.slides.filter((s) => !s.hidden).length;

  const startPresentation = async (): Promise<void> => {
    if (visibleCount === 0) {
      setError('Keine sichtbaren Folien zum Präsentieren.');
      return;
    }
    const visible = doc.slides.filter((s) => !s.hidden);
    const startIndex = Math.max(
      0,
      visible.findIndex((s) => s.id === selectedId),
    );
    const payload = buildPayload(startIndex);
    await window.jmpr.present.start(payload, audienceDisplay);
  };

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-[var(--border)]/60 bg-[var(--card)]/60 backdrop-blur-md">
      <div className="flex items-center gap-2.5 pr-2">
        <Logo size={26} />
        <div className="hidden md:flex flex-col leading-tight">
          <span className="text-xs font-extrabold tracking-[0.06em]">JM PRESENTER</span>
          <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Folien-Editor & Präsentation
          </span>
        </div>
      </div>

      <div className="h-6 w-px bg-[var(--border)]" />

      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={busy.active} onClick={() => void importDocs()}>
          + PDF / Bilder
        </button>
        <button type="button" className={btn} disabled={busy.active} onClick={() => void importOffice()}>
          + Office
        </button>
        <button type="button" className={btn} disabled={busy.active} onClick={() => void openProject()}>
          Öffnen
        </button>
        <button type="button" className={btn} disabled={busy.active} onClick={() => void saveProject()}>
          Speichern{dirty ? ' •' : ''}
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy.active || visibleCount === 0}
          onClick={() => void exportPdf()}
        >
          PDF-Export
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {busy.active && (
          <span className="text-xs text-[var(--muted-foreground)] animate-pulse">{busy.label}</span>
        )}

        <select
          value={audienceDisplay ?? ''}
          onChange={(e) => setAudienceDisplay(e.target.value ? Number(e.target.value) : null)}
          title="Publikums-Bildschirm"
          className="h-9 max-w-[200px] rounded-md bg-[var(--card)] border border-[var(--border)] px-2 text-xs"
        >
          {displays.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>

        {present.active ? (
          <button
            type="button"
            onClick={() => void window.jmpr.present.stop()}
            className={cn(btn, 'bg-[var(--destructive)] text-white border-[var(--destructive)]')}
          >
            ■ Beenden
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startPresentation()}
            disabled={busy.active || visibleCount === 0}
            className={cn(
              btn,
              'bg-[var(--primary)] text-[var(--brand-dark)] border-[var(--primary)] font-bold',
            )}
          >
            ▶ Präsentieren
          </button>
        )}
      </div>
    </header>
  );
}
