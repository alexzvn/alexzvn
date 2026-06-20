import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { cn } from '@jm/ui';
import { secToUs, usToSec } from '@shared/project';
import { useProject } from '@/store/project';
import { playbackUrl } from '@/lib/playback';
import { formatTimecode } from '@/lib/format';

/**
 * Quelle-Monitor: spielt ein einzelnes Roh-Asset (Proxy-bewusst) ab, lässt In-
 * und Out-Punkte setzen und das Ergebnis per Insert/Overwrite an den Programm-
 * Playhead in die Timeline packen (#33). Eigenständiger Transport (natives
 * <video>), unabhängig vom Programm-Monitor.
 */
export function SourceMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  const asset = useProject((s) => s.present.assets.find((a) => a.id === s.sourceAssetId) ?? null);
  const inUs = useProject((s) => s.sourceInUs);
  const outUs = useProject((s) => s.sourceOutUs);
  const headUs = useProject((s) => s.sourcePlayheadUs);
  const setHead = useProject((s) => s.setSourcePlayhead);
  const setIn = useProject((s) => s.setSourceIn);
  const setOut = useProject((s) => s.setSourceOut);
  const insertFromSource = useProject((s) => s.insertFromSource);

  const isImage = asset?.kind === 'image';
  const durUs = asset?.durationUs ?? 0;
  const url = asset ? playbackUrl(asset) : '';

  // Asset gewechselt → Quelle neu laden, an den Anfang.
  useEffect(() => {
    setPlaying(false);
    const v = videoRef.current;
    if (v && url && !isImage) {
      v.src = url;
      v.currentTime = 0;
    }
  }, [url, isImage]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || isImage) return;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing, isImage]);

  // Externer Sprung (Go-to-In/Out, Scrub) → Videoposition angleichen, wenn pausiert.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || isImage || playing) return;
    const t = usToSec(headUs);
    if (Math.abs(v.currentTime - t) > 0.05) v.currentTime = t;
  }, [headUs, playing, isImage]);

  const onTimeUpdate = (): void => {
    const v = videoRef.current;
    if (v && playing) setHead(secToUs(v.currentTime));
  };

  const seekToFraction = (clientX: number): void => {
    const bar = barRef.current;
    if (!bar || durUs <= 0) return;
    const rect = bar.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const us = Math.round(frac * durUs);
    setHead(us);
    const v = videoRef.current;
    if (v && !isImage) v.currentTime = usToSec(us);
  };

  const onBarDown = (e: RPointerEvent): void => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekToFraction(e.clientX);
  };
  const onBarMove = (e: RPointerEvent): void => {
    if (e.buttons !== 1) return;
    seekToFraction(e.clientX);
  };

  const pct = (us: number): string => `${durUs > 0 ? (us / durUs) * 100 : 0}%`;

  return (
    <div className="h-full flex flex-col min-h-0">
      <Label>Quelle{asset ? ` · ${asset.fileName}` : ''}</Label>

      <div className="flex-1 min-h-0 flex items-center justify-center bg-black/50 p-3">
        {!asset ? (
          <p className="text-xs text-[var(--muted-foreground)] text-center max-w-[220px] leading-relaxed">
            Doppelklick auf ein Medium öffnet es hier. In/Out setzen und per Einfügen/Überschreiben
            in die Timeline packen.
          </p>
        ) : isImage ? (
          <img src={url} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            onTimeUpdate={onTimeUpdate}
            onEnded={() => setPlaying(false)}
            className="max-w-full max-h-full object-contain bg-black"
          />
        )}
      </div>

      {/* Scrubber mit In/Out-Bereich */}
      <div className="px-3 pt-2">
        <div
          ref={barRef}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          className="relative h-6 rounded bg-[var(--card)]/70 border border-[var(--border)]/60 cursor-pointer select-none"
        >
          {/* In/Out-Bereich */}
          <div
            className="absolute top-0 bottom-0 bg-[var(--primary)]/25"
            style={{ left: pct(inUs), width: pct(Math.max(0, outUs - inUs)) }}
          />
          {/* In/Out-Marken */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--primary)]" style={{ left: pct(inUs) }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--primary)]" style={{ left: pct(outUs) }} />
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white"
            style={{ left: pct(headUs) }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-[var(--muted-foreground)]">
          <span>In {formatTimecode(inUs)}</span>
          <span className="text-[var(--foreground)]/90">{formatTimecode(headUs)} / {formatTimecode(durUs)}</span>
          <span>Out {formatTimecode(outUs)}</span>
        </div>
      </div>

      {/* Transport + Edit */}
      <div className="h-11 shrink-0 flex items-center justify-center gap-1.5 px-2 border-t border-[var(--border)]/50 bg-[var(--card)]/40">
        <Btn label="⏮" title="Zum In-Punkt" disabled={!asset} onClick={() => setHead(inUs)} />
        <Btn
          label={playing ? '⏸' : '▶'}
          title="Wiedergabe / Pause"
          primary
          disabled={!asset || isImage}
          onClick={() => setPlaying((p) => !p)}
        />
        <Btn label="⏭" title="Zum Out-Punkt" disabled={!asset} onClick={() => setHead(outUs)} />
        <div className="w-px h-5 bg-[var(--border)]/60 mx-1" />
        <Btn label="[ In" title="In setzen (I)" disabled={!asset} onClick={() => setIn(headUs)} />
        <Btn label="Out ]" title="Out setzen (O)" disabled={!asset} onClick={() => setOut(headUs)} />
        <div className="w-px h-5 bg-[var(--border)]/60 mx-1" />
        <Btn
          label="Einfügen"
          title="Am Playhead einfügen, Rest verschieben (,)"
          disabled={!asset}
          onClick={() => insertFromSource('insert')}
        />
        <Btn
          label="Überschr."
          title="Am Playhead überschreiben (.)"
          disabled={!asset}
          onClick={() => insertFromSource('overwrite')}
        />
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)] border-b border-[var(--border)]/40 truncate">
      {children}
    </div>
  );
}

function Btn({
  label,
  title,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 px-2 rounded-[var(--radius)] text-xs font-bold transition-colors disabled:opacity-30 disabled:pointer-events-none',
        primary
          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90'
          : 'border border-[var(--border)] text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}
