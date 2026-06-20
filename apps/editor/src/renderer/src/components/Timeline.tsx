import { useEffect, useRef, useState } from 'react';
import { cn } from '@jm/ui';
import {
  clipDurationUs,
  clipEndUs,
  projectDurationUs,
  secToUs,
  usToSec,
  type Clip,
  type Project,
  type Track,
} from '@shared/project';
import { useProject } from '@/store/project';
import { formatShort } from '@/lib/format';

const RULER_H = 26;
const TRACK_H = 58;
const HEADER_W = 116;
const MIN_DUR_US = secToUs(0.1);
const SNAP_PX = 7;

type DragMode = 'move' | 'trim-l' | 'trim-r' | 'playhead';
interface DragState {
  mode: DragMode;
  clipId?: string;
  grabOffsetUs?: number;
}

export function Timeline() {
  const tracks = useProject((s) => s.present.tracks);
  const present = useProject((s) => s.present);
  const pxPerSec = useProject((s) => s.pxPerSec);
  const setZoom = useProject((s) => s.setZoom);
  const playheadUs = useProject((s) => s.playheadUs);
  const setPlayhead = useProject((s) => s.setPlayhead);
  const select = useProject((s) => s.select);
  const selectedClipId = useProject((s) => s.selectedClipId);
  const splitAtPlayhead = useProject((s) => s.splitAtPlayhead);
  const deleteSelected = useProject((s) => s.deleteSelected);
  const addTitle = useProject((s) => s.addTitle);
  const addVideoTrack = useProject((s) => s.addVideoTrack);
  const activeVideoTrackId = useProject((s) => s.activeVideoTrackId);
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);

  const lanesRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const totalUs = projectDurationUs(present);
  const contentUs = Math.max(totalUs, secToUs(20));
  const widthPx = usToSec(contentUs) * pxPerSec + 80;

  const videoTracks = tracks.filter((t) => t.kind === 'video');
  const effectiveActiveId =
    activeVideoTrackId && videoTracks.some((t) => t.id === activeVideoTrackId)
      ? activeVideoTrackId
      : videoTracks[0]?.id;
  const videoCount = videoTracks.length;

  const usToPx = (us: number): number => usToSec(us) * pxPerSec;
  const pxToUs = (px: number): number => secToUs(px / pxPerSec);

  const clientToUs = (clientX: number): number => {
    const el = lanesRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, pxToUs(clientX - rect.left + el.scrollLeft));
  };

  // Snap-Kandidaten: Playhead + alle Clip-Kanten (außer dem gezogenen Clip).
  const snapTargets = (excludeId?: string): number[] => {
    const out = [0, playheadUs];
    for (const t of present.tracks)
      for (const c of t.clips) {
        if (c.id === excludeId) continue;
        out.push(c.startUs, clipEndUs(c));
      }
    return out;
  };
  const snap = (us: number, excludeId?: string): number => {
    const snapUs = pxToUs(SNAP_PX);
    let best = us;
    let bestD = snapUs;
    for (const target of snapTargets(excludeId)) {
      const d = Math.abs(target - us);
      if (d < bestD) {
        bestD = d;
        best = target;
      }
    }
    return best;
  };

  // ── Globale Pointer-Handler während eines Drags ───────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const us = clientToUs(e.clientX);
      if (drag.mode === 'playhead') {
        setPlayhead(snap(us));
        return;
      }
      const clipId = drag.clipId!;
      dragUpdate((draft) => applyDrag(draft, drag, us, snap));
      void clipId;
    };
    const onUp = (): void => {
      if (!dragRef.current) return;
      const mode = dragRef.current.mode;
      dragRef.current = null;
      if (mode !== 'playhead') endDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerSec, present, playheadUs]);

  const startClipDrag = (e: React.PointerEvent, clip: Clip, mode: DragMode): void => {
    e.stopPropagation();
    select(clip.id);
    if (mode === 'move') {
      dragRef.current = { mode, clipId: clip.id, grabOffsetUs: clientToUs(e.clientX) - clip.startUs };
    } else {
      dragRef.current = { mode, clipId: clip.id };
    }
    if (mode !== 'playhead') beginDrag();
  };

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/20 border-t border-[var(--border)]/60">
      {/* Werkzeugleiste */}
      <div className="h-10 shrink-0 flex items-center gap-1.5 px-2 border-b border-[var(--border)]/50">
        <TlButton label="✂ Teilen" onClick={splitAtPlayhead} />
        <TlButton label="🗑 Löschen" onClick={deleteSelected} disabled={!selectedClipId} />
        <TlButton label="T Titel" onClick={addTitle} />
        <TlButton label="+ Videospur" onClick={addVideoTrack} />
        <div className="flex-1" />
        <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Zoom</span>
        <TlButton label="–" onClick={() => setZoom(pxPerSec / 1.3)} />
        <TlButton label="+" onClick={() => setZoom(pxPerSec * 1.3)} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Spur-Köpfe */}
        <div className="shrink-0 border-r border-[var(--border)]/50" style={{ width: HEADER_W }}>
          <div style={{ height: RULER_H }} className="border-b border-[var(--border)]/40" />
          {tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              active={track.kind === 'video' && track.id === effectiveActiveId}
              removable={track.kind === 'video' && videoCount > 1}
            />
          ))}
        </div>

        {/* Timeline-Fläche (horizontal scrollbar) */}
        <div ref={lanesRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
          <div style={{ width: widthPx, position: 'relative' }}>
            <Ruler
              widthPx={widthPx}
              pxPerSec={pxPerSec}
              onSeek={(clientX) => setPlayhead(snap(clientToUs(clientX)))}
              onPlayheadDown={() => {
                dragRef.current = { mode: 'playhead' };
              }}
            />
            {tracks.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-[var(--border)]/30"
                style={{ height: TRACK_H }}
                onPointerDown={() => select(null)}
              >
                {track.clips.map((clip) => (
                  <ClipBlock
                    key={clip.id}
                    clip={clip}
                    track={track}
                    project={present}
                    selected={selectedClipId === clip.id}
                    leftPx={usToPx(clip.startUs)}
                    widthPx={Math.max(6, usToPx(clipDurationUs(clip)))}
                    onBodyDown={(e) => startClipDrag(e, clip, 'move')}
                    onTrimLeftDown={(e) => startClipDrag(e, clip, 'trim-l')}
                    onTrimRightDown={(e) => startClipDrag(e, clip, 'trim-r')}
                  />
                ))}
              </div>
            ))}

            {/* Playhead-Linie */}
            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--primary)] pointer-events-none"
              style={{ left: usToPx(playheadUs), height: RULER_H + tracks.length * TRACK_H }}
            >
              <div className="absolute -top-0 -left-[5px] w-[11px] h-[11px] rotate-45 bg-[var(--primary)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mutiert den Draft gemäß aktivem Drag (Move / Trim). */
function applyDrag(draft: Project, drag: DragState, pointerUs: number, snap: (us: number, ex?: string) => number): void {
  const loc = findClip(draft, drag.clipId!);
  if (!loc) return;
  const { clip } = loc;
  const asset = clip.assetId ? draft.assets.find((a) => a.id === clip.assetId) : undefined;
  const maxOutUs = asset ? asset.durationUs : Number.MAX_SAFE_INTEGER;

  if (drag.mode === 'move') {
    const raw = pointerUs - (drag.grabOffsetUs ?? 0);
    clip.startUs = Math.max(0, snap(raw, clip.id));
    return;
  }

  if (drag.mode === 'trim-l') {
    const end = clipEndUs(clip);
    let newStart = Math.min(snap(pointerUs, clip.id), end - MIN_DUR_US);
    newStart = Math.max(0, newStart);
    const delta = newStart - clip.startUs;
    if (clip.kind === 'media') {
      const newIn = clip.inUs + delta;
      if (newIn < 0) {
        clip.startUs -= clip.inUs; // an Quellanfang andocken
        clip.inUs = 0;
      } else {
        clip.startUs = newStart;
        clip.inUs = newIn;
      }
    } else {
      clip.startUs = newStart;
      clip.outUs = Math.max(MIN_DUR_US, clip.outUs - delta);
    }
    return;
  }

  // trim-r
  const newEnd = Math.max(clip.startUs + MIN_DUR_US, snap(pointerUs, clip.id));
  const newDur = newEnd - clip.startUs;
  if (clip.kind === 'media') {
    clip.outUs = Math.min(maxOutUs, clip.inUs + newDur);
  } else {
    clip.outUs = newDur;
  }
}

function findClip(project: Project, clipId: string): { track: Track; clip: Clip } | null {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

function Ruler({
  widthPx,
  pxPerSec,
  onSeek,
  onPlayheadDown,
}: {
  widthPx: number;
  pxPerSec: number;
  onSeek: (clientX: number) => void;
  onPlayheadDown: () => void;
}) {
  // Tick-Abstand: möglichst „runde" Sekundenzahl bei min. 60px.
  const targetPx = 70;
  const rawSec = targetPx / pxPerSec;
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  const stepSec = steps.find((s) => s >= rawSec) ?? 600;
  const count = Math.ceil(widthPx / (stepSec * pxPerSec)) + 1;

  return (
    <div
      className="sticky top-0 z-10 bg-[var(--card)]/70 backdrop-blur-sm border-b border-[var(--border)]/40 cursor-pointer select-none"
      style={{ height: RULER_H }}
      onPointerDown={(e) => {
        onPlayheadDown();
        onSeek(e.clientX);
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const left = i * stepSec * pxPerSec;
        return (
          <div key={i} className="absolute top-0 h-full" style={{ left }}>
            <div className="w-px h-2 bg-[var(--border)]" />
            <span className="absolute top-2 left-1 text-[9px] text-[var(--muted-foreground)] tabular-nums">
              {formatShort(secToUs(i * stepSec))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrackHeader({ track, active, removable }: { track: Track; active: boolean; removable: boolean }) {
  const commit = useProject((s) => s.commit);
  const setActiveVideoTrack = useProject((s) => s.setActiveVideoTrack);
  const removeTrack = useProject((s) => s.removeTrack);
  const isVideo = track.kind === 'video';
  const toggle = (key: 'muted' | 'locked'): void =>
    commit(key === 'muted' ? 'Spur stummschalten' : 'Spur sperren', (draft) => {
      const t = draft.tracks.find((tt) => tt.id === track.id);
      if (t) t[key] = !t[key];
    });
  return (
    <div
      onPointerDown={isVideo ? () => setActiveVideoTrack(track.id) : undefined}
      title={isVideo ? 'Klick: als Ziel-Videospur wählen' : undefined}
      className={cn(
        'group flex flex-col justify-center gap-1 px-2 border-b border-[var(--border)]/30',
        isVideo && 'cursor-pointer',
        active && 'bg-[var(--primary)]/10 border-l-2 border-l-[var(--primary)]',
      )}
      style={{ height: TRACK_H }}
    >
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-bold truncate">{track.name}</span>
        {active && <span className="text-[8px] uppercase tracking-wide text-[var(--primary)] font-bold">Ziel</span>}
        {removable && (
          <button
            type="button"
            title="Spur entfernen"
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(track.id);
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 w-4 h-4 rounded text-[10px] leading-none
                       text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <MiniToggle active={track.muted} label="M" title="Stumm" onClick={() => toggle('muted')} />
        <MiniToggle active={track.locked} label="L" title="Sperren" onClick={() => toggle('locked')} />
        <span className="text-[9px] uppercase text-[var(--muted-foreground)] ml-auto">{track.kind}</span>
      </div>
    </div>
  );
}

function MiniToggle({ active, label, title, onClick }: { active: boolean; label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'w-5 h-5 rounded text-[10px] font-bold',
        active ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'border border-[var(--border)] text-[var(--muted-foreground)]',
      )}
    >
      {label}
    </button>
  );
}

function ClipBlock({
  clip,
  track,
  project,
  selected,
  leftPx,
  widthPx,
  onBodyDown,
  onTrimLeftDown,
  onTrimRightDown,
}: {
  clip: Clip;
  track: Track;
  project: Project;
  selected: boolean;
  leftPx: number;
  widthPx: number;
  onBodyDown: (e: React.PointerEvent) => void;
  onTrimLeftDown: (e: React.PointerEvent) => void;
  onTrimRightDown: (e: React.PointerEvent) => void;
}) {
  const asset = clip.assetId ? project.assets.find((a) => a.id === clip.assetId) : undefined;
  const label = clip.kind === 'title' ? clip.title?.text ?? 'Titel' : asset?.fileName ?? 'Clip';
  const color =
    track.kind === 'overlay'
      ? 'bg-amber-500/25 border-amber-400/60'
      : track.kind === 'audio'
        ? 'bg-emerald-500/25 border-emerald-400/60'
        : 'bg-sky-500/25 border-sky-400/60';

  return (
    <div
      onPointerDown={onBodyDown}
      className={cn(
        'absolute top-1 bottom-1 rounded-md border overflow-hidden cursor-grab active:cursor-grabbing select-none',
        color,
        selected && 'ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--background)]',
      )}
      style={{ left: leftPx, width: widthPx }}
      title={label}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 hover:bg-[var(--primary)]"
        onPointerDown={onTrimLeftDown}
      />
      <div className="px-2 py-1 h-full flex flex-col justify-between pointer-events-none">
        <span className="text-[10px] font-semibold truncate">{label}</span>
        {clip.transitionIn && <span className="text-[8px] text-[var(--primary)]">↹ Blende</span>}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 hover:bg-[var(--primary)]"
        onPointerDown={onTrimRightDown}
      />
    </div>
  );
}

function TlButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-7 px-2.5 rounded-[var(--radius)] text-[11px] font-bold transition-colors whitespace-nowrap',
        'border border-[var(--border)] text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
        'disabled:opacity-30 disabled:cursor-not-allowed',
      )}
    >
      {label}
    </button>
  );
}
