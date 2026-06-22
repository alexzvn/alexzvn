import { useEffect, useState } from 'react';
import { cn } from '@jm/ui';
import type { Track } from '@shared/project';
import { useProject } from '@/store/project';
import { engine, type MeterData } from '@/audio/engine';
import { formatDb, formatPan } from '@/lib/format';

const GAIN_MAX = 1.6; // ~ +4 dB Headroom

/** Lineare Spitze (0..1) → Balkenhöhe in % (−60..0 dBFS). */
function meterPct(peak: number): number {
  if (peak <= 0) return 0;
  const db = 20 * Math.log10(peak);
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

export function Mixer() {
  const tracks = useProject((s) => s.present.tracks);
  const masterGain = useProject((s) => s.present.master.gain);
  const [meters, setMeters] = useState<MeterData>({ master: 0, tracks: {} });

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      if (t - last > 33) {
        setMeters(engine.meters());
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/30 border-l border-[var(--border)]/60">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/50">
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Mixer
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto flex gap-2 p-3">
        {tracks.map((track) => (
          <ChannelStrip key={track.id} track={track} meter={meters.tracks[track.id] ?? 0} />
        ))}
        <MasterStrip gain={masterGain} meter={meters.master} />
      </div>
    </div>
  );
}

function ChannelStrip({ track, meter }: { track: Track; meter: number }) {
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);
  const toggleMute = useProject((s) => s.toggleMute);
  const toggleSolo = useProject((s) => s.toggleSolo);

  const setGain = (v: number): void =>
    dragUpdate((d) => {
      const t = d.tracks.find((tt) => tt.id === track.id);
      if (t) t.gain = v;
    });
  const setPan = (v: number): void =>
    dragUpdate((d) => {
      const t = d.tracks.find((tt) => tt.id === track.id);
      if (t) t.pan = v;
    });

  return (
    <div className="w-[72px] shrink-0 h-full flex flex-col items-center gap-1.5 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]/50 bg-[var(--background)]/40 p-2">
      <span className="shrink-0 text-[10px] font-bold truncate w-full text-center" title={track.name}>
        {track.name}
      </span>

      <div className="shrink-0 w-full flex flex-col items-center">
        <input
          type="range"
          min={-1}
          max={1}
          step={0.02}
          value={track.pan}
          onPointerDown={beginDrag}
          onPointerUp={endDrag}
          onDoubleClick={() => {
            beginDrag();
            setPan(0);
            endDrag();
          }}
          onChange={(e) => setPan(Number(e.target.value))}
          title={`Pan ${formatPan(track.pan)} (Doppelklick: Mitte)`}
          className="w-full"
        />
        <span className="text-[9px] tabular-nums text-[var(--muted-foreground)] leading-tight">
          {formatPan(track.pan)}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-stretch justify-center gap-1.5">
        <Fader value={track.gain} onBegin={beginDrag} onEnd={endDrag} onChange={setGain} />
        <Meter pct={meterPct(meter)} />
      </div>

      <span className="shrink-0 text-[9px] tabular-nums text-[var(--muted-foreground)]">{formatDb(track.gain)} dB</span>

      <div className="shrink-0 flex items-center gap-1">
        <StripToggle active={track.muted} label="M" tone="mute" onClick={() => toggleMute(track.id)} />
        <StripToggle active={track.solo} label="S" tone="solo" onClick={() => toggleSolo(track.id)} />
      </div>
    </div>
  );
}

function MasterStrip({ gain, meter }: { gain: number; meter: number }) {
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);
  const setGain = (v: number): void =>
    dragUpdate((d) => {
      d.master.gain = v;
    });

  return (
    <div className="w-[80px] shrink-0 h-full flex flex-col items-center gap-1.5 overflow-hidden rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary)]/5 p-2 ml-1">
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--primary)]">Master</span>
      {/* Platzhalter, damit der Master-Fader auf Höhe der Kanal-Fader beginnt (Pan-Reihe). */}
      <div className="shrink-0 h-[18px]" />
      <div className="flex-1 min-h-0 flex items-stretch justify-center gap-1.5">
        <Fader value={gain} onBegin={beginDrag} onEnd={endDrag} onChange={setGain} />
        <Meter pct={meterPct(meter)} />
      </div>
      <span className="shrink-0 text-[9px] tabular-nums text-[var(--muted-foreground)]">{formatDb(gain)} dB</span>
    </div>
  );
}

/** Vertikaler Fader — echtes vertikales Range-Input (Chromium: writing-mode). */
function Fader({
  value,
  onBegin,
  onEnd,
  onChange,
}: {
  value: number;
  onBegin: () => void;
  onEnd: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={GAIN_MAX}
      step={0.01}
      value={value}
      onPointerDown={onBegin}
      onPointerUp={onEnd}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-full cursor-pointer"
      // Vertikal: unten = leise, oben = laut. Füllt die Resthöhe des Kanalzugs.
      style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 18 }}
    />
  );
}

function Meter({ pct }: { pct: number }) {
  return (
    <div className="w-2 h-full rounded-full bg-black/40 overflow-hidden relative">
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 transition-[height] duration-75',
          pct > 92 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-emerald-400',
        )}
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

function StripToggle({
  active,
  label,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  tone: 'mute' | 'solo';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-6 h-6 rounded text-[10px] font-bold',
        active
          ? tone === 'solo'
            ? 'bg-amber-400 text-black'
            : 'bg-[var(--primary)] text-[var(--primary-foreground)]'
          : 'border border-[var(--border)] text-[var(--muted-foreground)]',
      )}
    >
      {label}
    </button>
  );
}
