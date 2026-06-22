import { useEffect, useState } from 'react';
import { cn } from '@jm/ui';
import type { AudioDevice } from '@shared/ipc-types';
import { useProject } from '@/store/project';
import { armFlow, disarmFlow, listDevices, startRecFlow, stopRecFlow } from '@/lib/recording';

const selCls =
  'h-8 px-2 rounded-[var(--radius)] bg-[var(--background)] border border-[var(--border)] text-xs max-w-[200px]';

function meterPct(peak: number): number {
  if (peak <= 0) return 0;
  const db = 20 * Math.log10(peak);
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

export function RecordBar() {
  const rec = useProject((s) => s.rec);
  const tracks = useProject((s) => s.present.tracks);
  const setRecConfig = useProject((s) => s.setRecConfig);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = (): void => {
    listDevices()
      .then((d) => {
        setDevices(d);
        setLoadError(null);
        // Standardgerät vorwählen, falls keins gesetzt.
        if (d.length > 0 && useProject.getState().rec.deviceIndex == null) {
          setRecConfig({ deviceIndex: d[0].index, channels: Math.min(2, d[0].maxInputChannels) });
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const armed = rec.status === 'armed' || rec.status === 'recording';
  const recording = rec.status === 'recording';
  const peak = rec.levels.length ? Math.max(...rec.levels) : 0;

  return (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--border)]/50 bg-[var(--card)]/20">
      <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
        Aufnahme
      </span>

      <select
        className={selCls}
        value={rec.deviceIndex ?? ''}
        disabled={armed}
        onChange={(e) => setRecConfig({ deviceIndex: e.target.value === '' ? null : Number(e.target.value) })}
      >
        <option value="">Eingang wählen …</option>
        {devices.map((d) => (
          <option key={d.index} value={d.index}>
            {d.name} ({d.hostApiName})
          </option>
        ))}
      </select>

      <select
        className={selCls}
        value={rec.channels}
        disabled={armed}
        onChange={(e) => setRecConfig({ channels: Number(e.target.value) })}
        title="Kanäle"
      >
        <option value={1}>Mono</option>
        <option value={2}>Stereo</option>
      </select>

      <select
        className={selCls}
        value={rec.targetTrackId ?? ''}
        onChange={(e) => setRecConfig({ targetTrackId: e.target.value || null })}
        title="Ziel-Spur"
      >
        <option value="">Ziel: erste Spur</option>
        {tracks.map((t) => (
          <option key={t.id} value={t.id}>
            → {t.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => (armed ? void disarmFlow() : void armFlow())}
        disabled={recording}
        className={cn(
          'h-8 px-3 rounded-[var(--radius)] text-xs font-bold border',
          armed ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--highlight)]',
          'disabled:opacity-30',
        )}
      >
        {armed ? 'Eingang aus' : 'Eingang an'}
      </button>

      <button
        type="button"
        onClick={() => (recording ? void stopRecFlow() : void startRecFlow())}
        disabled={!armed}
        className={cn(
          'h-8 px-3 rounded-[var(--radius)] text-xs font-extrabold',
          recording ? 'bg-red-500 text-white' : 'bg-[var(--destructive)]/80 text-white hover:bg-[var(--destructive)]',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
      >
        {recording ? `■ Stop (${rec.recordedSec.toFixed(1)} s)` : '● Aufnehmen'}
      </button>

      {/* Pegel */}
      <div className="w-28 h-2 rounded-full bg-black/40 overflow-hidden">
        <div
          className={cn('h-full transition-[width] duration-75', meterPct(peak) > 92 ? 'bg-red-500' : meterPct(peak) > 75 ? 'bg-amber-400' : 'bg-emerald-400')}
          style={{ width: `${meterPct(peak)}%` }}
        />
      </div>

      {loadError && (
        <span className="text-[11px] text-amber-400" title={loadError}>
          Audio-Engine nicht verfügbar — Aufnahme deaktiviert
        </span>
      )}
      {rec.error && <span className="text-[11px] text-[var(--destructive)]">{rec.error}</span>}
      <button type="button" onClick={refresh} title="Geräte neu laden" className="ml-auto text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        ↻ Geräte
      </button>
    </div>
  );
}
