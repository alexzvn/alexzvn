import { useEffect, useRef, useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { ScreenSourceInfo } from '@shared/types';
import { SwitcherEngine, type EngineState, type SourceInfo } from '@/core/engine';

const PALETTE = ['#1d4ed8', '#dc2626', '#16a34a', '#9333ea', '#0891b2', '#ca8a04'];

export function SwitcherView() {
  const engineRef = useRef<SwitcherEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SwitcherEngine();
  const engine = engineRef.current;

  const previewRef = useRef<HTMLCanvasElement>(null);
  const programRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<EngineState>(() => engine.getState());
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (previewRef.current && programRef.current) {
      engine.attach(previewRef.current, programRef.current);
    }
    const unsub = engine.subscribe(() => setState(engine.getState()));
    setState(engine.getState());
    return () => {
      unsub();
      engine.destroy();
    };
  }, [engine]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const programSource = state.sources.find((s) => s.id === state.programId) ?? null;
  const previewSource = state.sources.find((s) => s.id === state.previewId) ?? null;
  const canTake = state.previewId != null;
  const canAuto = state.previewId != null && state.previewId !== state.programId && !state.transitioning;

  const addColor = (): void => {
    const n = state.sources.filter((s) => s.kind === 'color').length;
    engine.addColor(`Farbe ${n + 1}`, PALETTE[n % PALETTE.length]);
  };

  const pickScreen = async (screen: ScreenSourceInfo): Promise<void> => {
    setPicker(false);
    try {
      await window.jmswitch.armCapture(screen.id);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      engine.addScreenStream(screen.name, stream);
    } catch (e) {
      setNotice(`Bildschirm konnte nicht aufgenommen werden: ${(e as Error).message}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Monitore + Transition */}
      <div className="flex-1 min-h-0 flex items-center gap-5 px-6 py-5">
        <Monitor label="Preview" tone="preview" canvasRef={previewRef} sourceName={previewSource?.name} />

        <div className="shrink-0 flex flex-col items-center justify-center gap-3 w-28">
          <button
            type="button"
            disabled={!canTake}
            onClick={() => engine.cut()}
            className={cn(
              'w-full h-14 rounded-[var(--radius)] font-extrabold uppercase tracking-wide',
              'border-2 border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
          >
            Cut
          </button>
          <button
            type="button"
            disabled={!canAuto}
            onClick={() => engine.auto()}
            className={cn(
              'w-full h-14 rounded-[var(--radius)] font-extrabold uppercase tracking-wide',
              'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-opacity',
            )}
          >
            Auto
          </button>
          <label className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
            Dauer
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                step={50}
                value={state.autoMs}
                onChange={(e) => engine.setAutoMs(Number(e.target.value))}
                className="h-8 w-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm text-center tabular text-[var(--foreground)]"
              />
              <span className="text-[var(--muted-foreground)]">ms</span>
            </span>
          </label>
        </div>

        <Monitor label="Program" tone="program" canvasRef={programRef} sourceName={programSource?.name} />
      </div>

      {/* Quell-Bus */}
      <div className="shrink-0 border-t border-[var(--border)]/60 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
            Quellen
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)]">
            Klick = in Preview · Cut/Auto schaltet auf Program
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={addColor}>
              + Farbe
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPicker(true)}>
              + Bildschirm
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {state.sources.length === 0 && (
            <span className="text-sm text-[var(--muted-foreground)] py-4">
              Noch keine Quelle — füge eine Farbe oder einen Bildschirm hinzu.
            </span>
          )}
          {state.sources.map((s) => (
            <SourceChip
              key={s.id}
              source={s}
              isPreview={s.id === state.previewId}
              isProgram={s.id === state.programId}
              onClick={() => engine.setPreview(s.id)}
              onRemove={() => engine.removeSource(s.id)}
            />
          ))}
        </div>
      </div>

      {picker && <ScreenPicker onPick={(s) => void pickScreen(s)} onClose={() => setPicker(false)} />}

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center px-6">
          <div className="pointer-events-auto rounded-[var(--radius-lg)] border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-2xl text-center">
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}

function Monitor({
  label,
  tone,
  canvasRef,
  sourceName,
}: {
  label: string;
  tone: 'preview' | 'program';
  canvasRef: React.RefObject<HTMLCanvasElement>;
  sourceName?: string;
}) {
  const accent = tone === 'program' ? 'var(--destructive)' : 'var(--success)';
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: accent }}>
          {label}
        </span>
        <span className="text-[11px] text-[var(--muted-foreground)] truncate ml-3">
          {sourceName ?? '—'}
        </span>
      </div>
      <div
        className="relative w-full aspect-video rounded-[var(--radius-lg)] overflow-hidden bg-black border-2"
        style={{ borderColor: accent }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}

function SourceChip({
  source,
  isPreview,
  isProgram,
  onClick,
  onRemove,
}: {
  source: SourceInfo;
  isPreview: boolean;
  isProgram: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const ring = isProgram
    ? 'border-[var(--destructive)]'
    : isPreview
      ? 'border-[var(--primary)]'
      : 'border-[var(--border)] hover:bg-[var(--highlight)]';
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'h-16 w-32 rounded-[var(--radius)] border-2 overflow-hidden relative flex items-end justify-start',
          ring,
        )}
        style={source.kind === 'color' ? { background: source.color } : { background: '#1a1a1a' }}
      >
        <span className="m-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[11px] font-bold truncate max-w-[110px]">
          {source.name}
        </span>
        <div className="absolute top-1 right-1 flex gap-1">
          {isProgram && (
            <span className="px-1 rounded text-[9px] font-extrabold bg-[var(--destructive)] text-[var(--destructive-foreground)]">
              PGM
            </span>
          )}
          {isPreview && (
            <span className="px-1 rounded text-[9px] font-extrabold bg-[var(--primary)] text-[var(--primary-foreground)]">
              PVW
            </span>
          )}
        </div>
      </button>
      <button
        type="button"
        title="Quelle entfernen"
        onClick={onRemove}
        className="absolute -top-2 -left-2 size-5 grid place-items-center rounded-full bg-[var(--card)] border border-[var(--border)]
                   text-[var(--muted-foreground)] hover:text-[var(--destructive)] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function ScreenPicker({
  onPick,
  onClose,
}: {
  onPick: (s: ScreenSourceInfo) => void;
  onClose: () => void;
}) {
  const [screens, setScreens] = useState<ScreenSourceInfo[] | null>(null);

  useEffect(() => {
    let alive = true;
    window.jmswitch
      .listScreens()
      .then((s) => {
        if (alive) setScreens(s);
      })
      .catch(() => {
        if (alive) setScreens([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[80vh] overflow-auto scroll-thin rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold tracking-tight">Bildschirm / Fenster wählen</h2>
        {screens == null ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">Lade Quellen…</p>
        ) : screens.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">Keine aufnehmbaren Quellen gefunden.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {screens.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className="text-left rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden hover:border-[var(--primary)]/60 transition-colors"
              >
                <div className="aspect-video bg-black grid place-items-center overflow-hidden">
                  {s.thumbnailDataURL ? (
                    <img src={s.thumbnailDataURL} alt="" className="size-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-[var(--muted-foreground)] uppercase">{s.type}</span>
                  )}
                </div>
                <div className="px-2.5 py-2 text-xs font-semibold truncate">{s.name}</div>
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}
