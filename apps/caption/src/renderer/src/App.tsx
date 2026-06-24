import { useEffect, useRef, useState } from 'react';
import { useCaption } from '@/store/useCaption';
import { startCapture, type Capture } from '@/lib/capture';
import type { WhisperModelId } from '@shared/types';

const MODELS: { id: WhisperModelId; label: string }[] = [
  { id: 'tiny', label: 'Tiny (schnell)' },
  { id: 'base', label: 'Base' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large-v3', label: 'Large v3 (genau)' },
];
const LANGS = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'Englisch' },
  { id: 'auto', label: 'Auto-Erkennung' },
];
const sel = 'rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100';

export function App() {
  const { state, level, load, setLevel, setConfig, start, stop, setHold, clear, correctLast } = useCaption();
  const captureRef = useRef<Capture | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Aufnahme-Lebenszyklus an das running-Flag koppeln.
  const running = state?.running ?? false;
  const cfg = state?.config;
  useEffect(() => {
    if (running && !captureRef.current && cfg) {
      let cancelled = false;
      startCapture(
        {
          silenceMs: cfg.silenceMs,
          silenceThreshold: cfg.silenceThreshold,
          maxUtteranceSec: cfg.maxUtteranceSec,
          onLevel: (r) => setLevel(r),
        },
        (pcm, sr) => window.jmcaption.pushUtterance(pcm, sr),
      )
        .then((cap) => {
          if (cancelled) cap.stop();
          else {
            captureRef.current = cap;
            setMicError(null);
          }
        })
        .catch((e: unknown) => setMicError(String((e as Error)?.message ?? e)));
      return () => {
        cancelled = true;
      };
    }
    if (!running && captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
      setLevel(0);
    }
    return undefined;
  }, [running, cfg, setLevel]);

  // Beim Verlassen Aufnahme sicher stoppen.
  useEffect(() => () => captureRef.current?.stop(), []);

  if (!state) {
    return <div className="grid h-full place-items-center text-neutral-500">Lädt …</div>;
  }

  const lines = state.lines;
  const last = lines.length ? lines[lines.length - 1] : null;
  const levelPct = Math.min(100, Math.round((level / 0.15) * 100));

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="font-bold">JM Caption</span>
        <select
          value={state.config.model}
          onChange={(e) => void setConfig({ model: e.target.value as WhisperModelId })}
          className={sel}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={state.config.language}
          onChange={(e) => void setConfig({ language: e.target.value })}
          className={sel}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void (running ? stop() : start())}
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-[var(--brand-dark)]"
            style={{ background: running ? '#e0533d' : 'var(--brand-yellow)' }}
          >
            {running ? '■ Stopp' : '● Start'}
          </button>
          <button
            onClick={() => void setHold(!state.hold)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              state.hold ? 'border-yellow-500 text-yellow-300' : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {state.hold ? 'Hold ✓' : 'Hold'}
          </button>
          <button
            onClick={() => void clear()}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Leeren
          </button>
        </div>
      </header>

      {/* Warnungen */}
      {!state.whisperAvailable && (
        <div className="bg-yellow-500/10 px-4 py-1.5 text-xs text-yellow-300">
          whisper.cpp ist hier nicht gebündelt — Transkription läuft erst nach dem Office-Build (Binary + Modell).
        </div>
      )}
      {micError && (
        <div className="bg-red-500/10 px-4 py-1.5 text-xs text-red-300">Mikrofon: {micError}</div>
      )}
      {state.error && (
        <div className="bg-red-500/10 px-4 py-1.5 text-xs text-red-300">{state.error}</div>
      )}

      {/* Live-Untertitel (groß) */}
      <div className="grid flex-1 place-items-center p-6">
        <div className="w-full max-w-3xl text-center">
          <div className="min-h-[3.5rem] text-3xl font-semibold leading-snug">
            {last ? last.text : <span className="text-neutral-600">— bereit —</span>}
          </div>
        </div>
      </div>

      {/* Verlauf + Pegel */}
      <div className="border-t border-neutral-800">
        <div className="flex items-center gap-3 px-4 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Pegel</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{ width: `${levelPct}%`, background: levelPct > 80 ? '#e0533d' : 'var(--brand-yellow)' }}
            />
          </div>
          {state.busy && <span className="text-[10px] text-neutral-400">transkribiert …</span>}
          <span className="text-[10px] text-neutral-500">{lines.length} Zeilen</span>
        </div>
        <div className="max-h-44 overflow-y-auto px-4 pb-3">
          {lines
            .slice()
            .reverse()
            .map((l) =>
              editing === l.id ? (
                <input
                  key={l.id}
                  autoFocus
                  defaultValue={l.text}
                  onBlur={(e) => {
                    void correctLast(e.target.value);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="my-0.5 w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-sm"
                />
              ) : (
                <div
                  key={l.id}
                  onDoubleClick={() => l.id === last?.id && setEditing(l.id)}
                  title={l.id === last?.id ? 'Doppelklick: letzte Zeile korrigieren' : undefined}
                  className="border-b border-neutral-800/50 py-1 text-sm text-neutral-300"
                >
                  {l.text}
                </div>
              ),
            )}
          {lines.length === 0 && (
            <div className="py-3 text-center text-xs text-neutral-600">Noch keine Untertitel.</div>
          )}
        </div>
      </div>
    </div>
  );
}
