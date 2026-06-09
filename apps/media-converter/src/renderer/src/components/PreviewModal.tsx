import { useEffect, useRef, useState } from 'react';
import type { PreviewRequest, PreviewResult } from '@shared/types';
import { Button } from '@jm/ui';
import { cn } from '@jm/ui';
import { formatBytes, formatDuration, parseDuration } from '@/lib/format';

interface Props {
  fileName: string;
  baseReq: Omit<PreviewRequest, 'atSec'>;
  /** Aktueller Trim-Bereich der Datei (Sekunden). */
  trimStart: number;
  trimEnd: number;
  /** Übernimmt einen geänderten Trim-Bereich zurück in die Dateiliste. */
  onApplyTrim: (start: number, end: number) => void;
  onClose: () => void;
}

export function PreviewModal({ fileName, baseReq, trimStart, trimEnd, onApplyTrim, onClose }: Props) {
  const dur = baseReq.durationSec;
  const [inSec, setInSec] = useState(Math.max(0, trimStart));
  const [outSec, setOutSec] = useState(trimEnd > trimStart ? trimEnd : dur);
  const [playhead, setPlayhead] = useState(Math.max(0, trimStart));
  const [frame, setFrame] = useState<string>('');
  const [frameLoading, setFrameLoading] = useState(false);

  const [quality, setQuality] = useState<PreviewResult | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimLen = Math.max(0, outSec - inSec);
  const valid = inSec >= 0 && outSec > inSec && outSec <= dur + 0.5;

  // Geänderten Trim live in die Dateiliste zurückschreiben.
  useEffect(() => {
    if (valid) onApplyTrim(inSec, outSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSec, outSec]);

  const reqSeq = useRef(0);
  async function grab(t: number): Promise<void> {
    const seq = ++reqSeq.current;
    setFrameLoading(true);
    try {
      const res = await window.jmc.media.frame({
        inputPath: baseReq.inputPath,
        atSec: t,
        scaleHeight: baseReq.scaleHeight,
      });
      if (seq === reqSeq.current) setFrame(res.dataUrl);
    } catch {
      // Einzelbild-Fehler still ignorieren (Slider bleibt bedienbar)
    } finally {
      if (seq === reqSeq.current) setFrameLoading(false);
    }
  }

  useEffect(() => {
    void grab(Math.max(0, trimStart));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seek(t: number): void {
    const clamped = Math.min(Math.max(0, t), Math.max(0, dur - 0.05));
    setPlayhead(clamped);
    void grab(clamped);
  }

  async function checkQuality(): Promise<void> {
    setQualityLoading(true);
    setError(null);
    try {
      const res = await window.jmc.media.previewFrame({ ...baseReq, atSec: playhead });
      setQuality(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Qualitäts-Vorschau fehlgeschlagen.');
    } finally {
      setQualityLoading(false);
    }
  }

  const pct = (t: number): number => (dur > 0 ? Math.min(100, Math.max(0, (t / dur) * 100)) : 0);
  // Größenschätzung auf den getrimmten Bereich umrechnen.
  const estTrimmed =
    quality && quality.estimatedBytes > 0 && dur > 0 ? quality.estimatedBytes * (trimLen / dur) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">Vorschau &amp; Beschneiden</h2>
            <p className="truncate text-xs text-[var(--muted-foreground)]">{fileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] uppercase tracking-wide font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Schließen
          </button>
        </div>

        {/* Bild an der aktuellen Position */}
        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black flex items-center justify-center">
          {frame ? (
            <img src={frame} alt="Vorschau" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-[var(--muted-foreground)]">—</span>
          )}
          {frameLoading && (
            <div className="absolute right-2 top-2 rounded-[var(--radius)] bg-black/50 px-2 py-1 text-[10px] font-bold text-white">
              lädt…
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-[var(--radius)] bg-black/50 px-2 py-1 text-[10px] font-bold tabular text-white">
            {formatDuration(playhead)}
          </span>
        </div>

        {/* Timeline mit Trim-Bereich + Abspielkopf */}
        <div className="mt-4">
          <div className="relative h-2 w-full rounded-[var(--radius-full)] bg-[var(--muted)]">
            <div
              className="absolute inset-y-0 rounded-[var(--radius-full)] bg-[var(--primary)]/35"
              style={{ left: `${pct(inSec)}%`, width: `${Math.max(0, pct(outSec) - pct(inSec))}%` }}
            />
            <div
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--card)] bg-[var(--primary)]"
              style={{ left: `${pct(playhead)}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, dur - 0.05)}
            step={0.1}
            value={playhead}
            disabled={dur <= 0}
            onChange={(e) => setPlayhead(Number(e.target.value))}
            onMouseUp={(e) => seek(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => seek(Number((e.target as HTMLInputElement).value))}
            className="mt-1 h-7 w-full accent-[var(--primary)]"
          />
        </div>

        {/* Trim-Steuerung */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <Button variant="outline" size="sm" onClick={() => setInSec(playhead)} disabled={playhead >= outSec}>
            Start = Position
          </Button>
          <Button variant="outline" size="sm" onClick={() => seek(inSec)}>
            → Start
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOutSec(playhead)} disabled={playhead <= inSec}>
            Ende = Position
          </Button>
          <Button variant="outline" size="sm" onClick={() => seek(Math.max(inSec, outSec - 0.1))}>
            → Ende
          </Button>
          <span className="ml-auto flex items-center gap-2 text-[var(--muted-foreground)]">
            <span>Start</span>
            <TimeField value={inSec} onChange={setInSec} />
            <span>Ende</span>
            <TimeField value={outSec} onChange={setOutSec} />
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          {valid ? (
            <span className="text-[var(--muted-foreground)] tabular">
              Beschnittene Dauer <span className="font-bold text-[var(--foreground)]">{formatDuration(trimLen)}</span>
              {trimLen < dur - 0.05 ? ` (von ${formatDuration(dur)})` : ''}
            </span>
          ) : (
            <span className="font-bold text-[var(--destructive)]">
              Ungültiger Bereich (Ende muss nach Start und innerhalb der Länge liegen).
            </span>
          )}
        </div>

        {/* Qualitäts-Vergleich (auf Wunsch, da Encode langsamer) */}
        <div className="mt-4 border-t border-[var(--border)]/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
              Qualitäts-Vergleich an der aktuellen Position
            </span>
            <Button variant="outline" size="sm" onClick={checkQuality} disabled={qualityLoading || dur <= 0}>
              {qualityLoading ? 'Encodiere…' : 'Qualität prüfen'}
            </Button>
          </div>

          {error && <p className="mt-2 text-xs text-[var(--destructive)]">{error}</p>}

          {quality && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Frame label="Original" src={quality.originalDataUrl} />
                <Frame label="Ergebnis" src={quality.encodedDataUrl} />
              </div>
              {estTrimmed > 0 && (
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Geschätzte Ausgabegröße (Video, beschnitten):{' '}
                  <span className="font-bold text-[var(--foreground)]">{formatBytes(estTrimmed)}</span>{' '}
                  <span className="opacity-70">· hochgerechnet aus {quality.segmentSec.toFixed(1)} s Probe-Encode</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimeField({ value, onChange }: { value: number; onChange: (sec: number) => void }) {
  const [text, setText] = useState(formatDuration(value));
  useEffect(() => {
    setText(formatDuration(value));
  }, [value]);
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const p = parseDuration(e.target.value);
        if (p != null) onChange(p);
      }}
      spellCheck={false}
      className="w-20 h-7 px-2 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-[12px] tabular text-center focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
    />
  );
}

function Frame({ label, src }: { label: string; src?: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">{label}</p>
      <div
        className={cn(
          'aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black',
          'flex items-center justify-center',
        )}
      >
        {src ? (
          <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">—</span>
        )}
      </div>
    </div>
  );
}
