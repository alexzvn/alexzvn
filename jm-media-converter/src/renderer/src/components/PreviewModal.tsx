import { useEffect, useState } from 'react';
import type { PreviewRequest, PreviewResult } from '@shared/types';
import { Button } from './ui/Button';
import { cn } from '@/lib/cn';
import { formatBytes, formatDuration } from '@/lib/format';

interface Props {
  fileName: string;
  baseReq: Omit<PreviewRequest, 'atSec'>;
  onClose: () => void;
}

export function PreviewModal({ fileName, baseReq, onClose }: Props) {
  const dur = baseReq.durationSec;
  const initial = dur > 0 ? Math.min(dur * 0.1, Math.max(0, dur - 2)) : 0;
  const [atSec, setAtSec] = useState(initial);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(t: number): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await window.jmc.media.previewFrame({ ...baseReq, atSec: t });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vorschau fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em]">Qualitäts-Vorschau</h2>
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

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <Frame label="Original" src={result?.originalDataUrl} />
          <Frame label="Ergebnis" src={result?.encodedDataUrl} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-lg)] bg-black/40 text-sm font-bold text-[var(--foreground)]">
              Encodiere Vorschau…
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-[var(--destructive)]">{error}</p>}

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)] tabular">
              {formatDuration(atSec)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, dur - 0.1)}
              step={0.1}
              value={atSec}
              disabled={dur <= 0}
              onChange={(e) => setAtSec(Number(e.target.value))}
              onMouseUp={(e) => run(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => run(Number((e.target as HTMLInputElement).value))}
              className="h-8 flex-1 accent-[var(--primary)]"
            />
            <Button variant="outline" size="sm" onClick={() => run(atSec)} disabled={loading}>
              Frame laden
            </Button>
          </div>

          {result && result.estimatedBytes > 0 && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Geschätzte Ausgabegröße (Video):{' '}
              <span className="text-[var(--foreground)] font-bold">{formatBytes(result.estimatedBytes)}</span>{' '}
              <span className="opacity-70">· hochgerechnet aus {result.segmentSec.toFixed(1)} s Probe-Encode</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Frame({ label, src }: { label: string; src?: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
        {label}
      </p>
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
