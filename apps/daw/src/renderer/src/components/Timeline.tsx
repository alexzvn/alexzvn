import { useEffect, useRef, useState } from 'react';
import { cn } from '@jm/ui';
import {
  clipDurationUs,
  clipEndUs,
  projectDurationUs,
  secToUs,
  usToSec,
  type AutomationPoint,
  type Clip,
  type MediaAsset,
  type Project,
  type Track,
} from '@shared/project';
import { useProject } from '@/store/project';
import { formatShort } from '@/lib/format';
import { useWaveform } from '@/lib/useWaveform';
import { PEAKS_PER_SEC } from '@/audio/waveform';
import { snapSourceUsToZero } from '@/lib/zerocross';

const RULER_H = 26;
const LOOP_H = 16;
const TRACK_H = 76;
const HEADER_W = 150;
const MIN_DUR_US = secToUs(0.05);
const SNAP_PX = 7;
const GAIN_MAX = 1.6;
const CLIP_INSET = 4; // top-1/bottom-1 des Clips (px)

type DragMode = 'move' | 'trim-l' | 'trim-r' | 'fade-l' | 'fade-r' | 'gain' | 'playhead' | 'loop' | 'auto';
type AutoParam = 'gain' | 'pan';
interface DragState {
  mode: DragMode;
  clipId?: string;
  grabOffsetUs?: number;
  autoTrackId?: string;
  autoParam?: AutoParam;
  autoIndex?: number;
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
  const duplicateSelected = useProject((s) => s.duplicateSelected);
  const addTrack = useProject((s) => s.addTrack);
  const activeTrackId = useProject((s) => s.activeTrackId);
  const beginDrag = useProject((s) => s.beginDrag);
  const dragUpdate = useProject((s) => s.dragUpdate);
  const endDrag = useProject((s) => s.endDrag);
  const zeroCrossEnabled = useProject((s) => s.zeroCrossEnabled);
  const setZeroCross = useProject((s) => s.setZeroCross);
  const loopEnabled = useProject((s) => s.loopEnabled);
  const loopStartUs = useProject((s) => s.loopStartUs);
  const loopEndUs = useProject((s) => s.loopEndUs);
  const setLoopRegion = useProject((s) => s.setLoopRegion);
  const toggleLoop = useProject((s) => s.toggleLoop);
  const clearLoop = useProject((s) => s.clearLoop);
  const addAutoPoint = useProject((s) => s.addAutoPoint);
  const removeAutoPoint = useProject((s) => s.removeAutoPoint);
  const clearAutomation = useProject((s) => s.clearAutomation);

  // Welche Automations-Hüllkurve je Spur sichtbar/editierbar ist (View-Status).
  const [autoView, setAutoView] = useState<Record<string, AutoParam>>({});
  const cycleAuto = (trackId: string): void =>
    setAutoView((v) => {
      const cur = v[trackId];
      const next: AutoParam | undefined = cur === undefined ? 'gain' : cur === 'gain' ? 'pan' : undefined;
      const { [trackId]: _drop, ...rest } = v;
      return next ? { ...rest, [trackId]: next } : rest;
    });

  const lanesRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const totalUs = projectDurationUs(present);
  const contentUs = Math.max(totalUs, secToUs(30));
  const widthPx = usToSec(contentUs) * pxPerSec + 80;

  // Nur Audio-Spuren erscheinen als Timeline-Lanes; Busse leben im Mixer.
  const lanes = tracks.filter((t) => t.kind === 'audio');
  const effectiveActiveId =
    activeTrackId && lanes.some((t) => t.id === activeTrackId) ? activeTrackId : lanes[0]?.id;

  const usToPx = (us: number): number => usToSec(us) * pxPerSec;
  const pxToUs = (px: number): number => secToUs(px / pxPerSec);

  const clientToUs = (clientX: number): number => {
    const el = lanesRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, pxToUs(clientX - rect.left + el.scrollLeft));
  };

  // Spur-Index unter dem Cursor (für Cross-Track-Move). Bezieht die Loop-Leiste mit ein.
  const trackIndexAtY = (clientY: number): number => {
    const el = lanesRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const idx = Math.floor((clientY - rect.top - LOOP_H - RULER_H) / TRACK_H);
    return Math.max(0, Math.min(lanes.length - 1, idx));
  };

  // Cursor-Y → linearer Gain (oben = laut), bezogen auf die Lane eines Clips.
  const clientToGain = (clientY: number, laneIndex: number): number => {
    const el = lanesRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    const bodyTop = rect.top + LOOP_H + RULER_H + laneIndex * TRACK_H + CLIP_INSET;
    const bodyH = TRACK_H - 2 * CLIP_INSET;
    const rel = Math.max(0, Math.min(1, (clientY - bodyTop) / bodyH));
    return GAIN_MAX * (1 - rel);
  };

  // Cursor-Y → Automationswert (Vol 0..GAIN_MAX, Pan -1..+1) über die volle Lane-Höhe.
  const clientToAutoValue = (clientY: number, laneIndex: number, param: AutoParam): number => {
    const el = lanesRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const laneTop = rect.top + LOOP_H + RULER_H + laneIndex * TRACK_H;
    const rel = Math.max(0, Math.min(1, (clientY - laneTop) / TRACK_H));
    return param === 'gain' ? GAIN_MAX * (1 - rel) : 1 - 2 * rel;
  };

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

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.mode === 'playhead') {
        setPlayhead(snap(clientToUs(e.clientX)));
        return;
      }
      if (drag.mode === 'loop') {
        setLoopRegion(drag.grabOffsetUs ?? 0, clientToUs(e.clientX));
        return;
      }
      if (drag.mode === 'gain') {
        const li = laneIndexOfClip(lanes, drag.clipId!);
        if (li >= 0) {
          const g = clientToGain(e.clientY, li);
          dragUpdate((d) => setClipGain(d, drag.clipId!, g));
        }
        return;
      }
      if (drag.mode === 'auto') {
        const li = lanes.findIndex((t) => t.id === drag.autoTrackId);
        if (li >= 0 && drag.autoParam) {
          const us = clientToUs(e.clientX);
          const value = clientToAutoValue(e.clientY, li, drag.autoParam);
          dragUpdate((d) => moveAutoPoint(d, drag, us, value));
        }
        return;
      }
      const us = clientToUs(e.clientX);
      if (drag.mode === 'move') {
        const targetId = lanes[trackIndexAtY(e.clientY)]?.id;
        dragUpdate((d) => applyMove(d, drag, us, snap, targetId));
        return;
      }
      dragUpdate((d) => applyTrimFade(d, drag, us, snap));
    };
    const onUp = (): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const { mode, clipId } = drag;
      dragRef.current = null;
      if (mode === 'playhead' || mode === 'loop') return;
      // Nulldurchgang-Rastung beim Loslassen eines Trims.
      if ((mode === 'trim-l' || mode === 'trim-r') && clipId && zeroCrossEnabled) {
        dragUpdate((d) => snapTrimToZero(d, clipId, mode));
      }
      endDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerSec, present, playheadUs, zeroCrossEnabled, tracks.length]);

  // Alt + Mausrad → Zoom (am Cursor verankert); normales Rad → horizontal scrollen.
  useEffect(() => {
    const el = lanesRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      const st = useProject.getState();
      if (e.altKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cursorSec = (e.clientX - rect.left + el.scrollLeft) / st.pxPerSec;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newPx = Math.max(8, Math.min(600, st.pxPerSec * factor));
        st.setZoom(newPx);
        // Scrollposition so anpassen, dass die Zeit unter dem Cursor stehen bleibt.
        requestAnimationFrame(() => {
          el.scrollLeft = cursorSec * newPx - (e.clientX - rect.left);
        });
      } else if (e.deltaY !== 0 && !e.shiftKey) {
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startClipDrag = (e: React.PointerEvent, clip: Clip, mode: DragMode): void => {
    e.stopPropagation();
    select(clip.id);
    dragRef.current = {
      mode,
      clipId: clip.id,
      grabOffsetUs: mode === 'move' ? clientToUs(e.clientX) - clip.startUs : undefined,
    };
    beginDrag();
  };

  return (
    <div className="h-full flex flex-col bg-[var(--card)]/20 border-t border-[var(--border)]/60">
      <div className="h-10 shrink-0 flex items-center gap-1.5 px-2 border-b border-[var(--border)]/50">
        <TlButton label="✂ Teilen" onClick={splitAtPlayhead} />
        <TlButton label="⧉ Duplizieren" onClick={duplicateSelected} disabled={!selectedClipId} />
        <TlButton label="🗑 Löschen" onClick={deleteSelected} disabled={!selectedClipId} />
        <TlButton label="+ Spur" onClick={addTrack} />
        <TlToggle label="⌁ Nulldurchgang" active={zeroCrossEnabled} onClick={() => setZeroCross(!zeroCrossEnabled)} title="Schnitte/Trims auf den nächsten Nulldurchgang rasten" />
        <TlToggle label="⟳ Loop" active={loopEnabled} onClick={toggleLoop} title="Loop-Wiedergabe (Bereich in der Loop-Leiste ziehen)" />
        <div className="flex-1" />
        <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Zoom</span>
        <TlButton label="–" onClick={() => setZoom(pxPerSec / 1.3)} />
        <TlButton label="+" onClick={() => setZoom(pxPerSec * 1.3)} />
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="shrink-0 border-r border-[var(--border)]/50" style={{ width: HEADER_W }}>
          <div style={{ height: LOOP_H + RULER_H }} className="border-b border-[var(--border)]/40" />
          {lanes.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              active={track.id === effectiveActiveId}
              removable={lanes.length > 1}
              autoParam={autoView[track.id]}
              onCycleAuto={() => cycleAuto(track.id)}
              onClearAuto={() => {
                const p = autoView[track.id];
                if (p) clearAutomation(track.id, p);
              }}
            />
          ))}
        </div>

        <div ref={lanesRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
          <div style={{ width: widthPx, position: 'relative' }}>
            {/* Loop-Leiste: ziehen setzt den Bereich, Doppelklick löscht ihn. */}
            <div
              className="relative border-b border-[var(--border)]/40 bg-[var(--background)]/40 cursor-crosshair select-none"
              style={{ height: LOOP_H }}
              title="Ziehen: Loop-Bereich setzen · Doppelklick: löschen"
              onPointerDown={(e) => {
                const a = clientToUs(e.clientX);
                dragRef.current = { mode: 'loop', grabOffsetUs: a };
                setLoopRegion(a, a);
              }}
              onDoubleClick={() => clearLoop()}
            >
              {loopEndUs > loopStartUs && (
                <div
                  className={cn(
                    'absolute top-[2px] bottom-[2px] rounded-sm',
                    loopEnabled ? 'bg-[var(--primary)]/70' : 'bg-[var(--muted-foreground)]/40',
                  )}
                  style={{ left: usToPx(loopStartUs), width: Math.max(2, usToPx(loopEndUs - loopStartUs)) }}
                />
              )}
            </div>
            <Ruler
              widthPx={widthPx}
              pxPerSec={pxPerSec}
              onSeek={(clientX) => setPlayhead(snap(clientToUs(clientX)))}
              onPlayheadDown={() => {
                dragRef.current = { mode: 'playhead' };
              }}
            />
            {lanes.map((track, li) => {
              const ap = autoView[track.id];
              return (
                <div
                  key={track.id}
                  className="relative border-b border-[var(--border)]/30"
                  style={{ height: TRACK_H }}
                  onPointerDown={ap ? undefined : () => select(null)}
                >
                  <div className={cn('absolute inset-0', ap && 'opacity-40 pointer-events-none')}>
                    {track.clips.map((clip) => (
                      <ClipBlock
                        key={clip.id}
                        clip={clip}
                        project={present}
                        selected={selectedClipId === clip.id}
                        leftPx={usToPx(clip.startUs)}
                        widthPx={Math.max(6, usToPx(clipDurationUs(clip)))}
                        onStart={(e, mode) => startClipDrag(e, clip, mode)}
                      />
                    ))}
                  </div>
                  {ap && (
                    <AutomationOverlay
                      points={track.automation?.[ap] ?? []}
                      param={ap}
                      widthPx={widthPx}
                      toX={(us) => usToPx(us)}
                      onAdd={(clientX, clientY) =>
                        addAutoPoint(track.id, ap, clientToUs(clientX), clientToAutoValue(clientY, li, ap))
                      }
                      onPointDown={(e, idx) => {
                        e.stopPropagation();
                        dragRef.current = { mode: 'auto', autoTrackId: track.id, autoParam: ap, autoIndex: idx };
                        beginDrag();
                      }}
                      onPointRemove={(idx) => removeAutoPoint(track.id, ap, idx)}
                    />
                  )}
                </div>
              );
            })}

            {/* Loop-Bereich über die Spuren (visuelle Markierung) */}
            {loopEnabled && loopEndUs > loopStartUs && (
              <div
                className="absolute pointer-events-none bg-[var(--primary)]/8 border-x border-[var(--primary)]/40"
                style={{
                  left: usToPx(loopStartUs),
                  width: Math.max(2, usToPx(loopEndUs - loopStartUs)),
                  top: LOOP_H,
                  height: RULER_H + lanes.length * TRACK_H,
                }}
              />
            )}

            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--primary)] pointer-events-none"
              style={{ left: usToPx(playheadUs), height: LOOP_H + RULER_H + lanes.length * TRACK_H }}
            >
              <div className="absolute -top-0 -left-[5px] w-[11px] h-[11px] rotate-45 bg-[var(--primary)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drag-Anwendung ────────────────────────────────────────────────────────────

function applyMove(
  draft: Project,
  drag: DragState,
  pointerUs: number,
  snap: (us: number, ex?: string) => number,
  targetTrackId: string | undefined,
): void {
  const loc = findClip(draft, drag.clipId!);
  if (!loc) return;
  const { track: curTrack, clip } = loc;
  const raw = pointerUs - (drag.grabOffsetUs ?? 0);
  clip.startUs = Math.max(0, snap(raw, clip.id));
  if (targetTrackId && targetTrackId !== curTrack.id) {
    const target = draft.tracks.find((t) => t.id === targetTrackId);
    if (target && !target.locked) {
      curTrack.clips = curTrack.clips.filter((c) => c.id !== clip.id);
      target.clips.push(clip);
    }
  }
}

function applyTrimFade(draft: Project, drag: DragState, pointerUs: number, snap: (us: number, ex?: string) => number): void {
  const loc = findClip(draft, drag.clipId!);
  if (!loc) return;
  const { clip } = loc;
  const asset = draft.assets.find((a) => a.id === clip.assetId);
  const maxOutUs = asset ? asset.durationUs : Number.MAX_SAFE_INTEGER;

  if (drag.mode === 'trim-l') {
    const end = clipEndUs(clip);
    let newStart = Math.min(snap(pointerUs, clip.id), end - MIN_DUR_US);
    newStart = Math.max(0, newStart);
    const delta = newStart - clip.startUs;
    const newIn = clip.inUs + delta;
    if (newIn < 0) {
      clip.startUs -= clip.inUs;
      clip.inUs = 0;
    } else {
      clip.startUs = newStart;
      clip.inUs = newIn;
    }
    clampFade(clip);
    return;
  }

  if (drag.mode === 'trim-r') {
    const newEnd = Math.max(clip.startUs + MIN_DUR_US, snap(pointerUs, clip.id));
    const newDur = newEnd - clip.startUs;
    clip.outUs = Math.min(maxOutUs, clip.inUs + newDur);
    clampFade(clip);
    return;
  }

  const dur = clipDurationUs(clip);
  if (drag.mode === 'fade-l') {
    const inUs = Math.max(0, Math.min(pointerUs - clip.startUs, dur));
    const out = clip.fade?.outUs ?? 0;
    clip.fade = { inUs: Math.min(inUs, dur - out), outUs: out };
    return;
  }
  if (drag.mode === 'fade-r') {
    const outUs = Math.max(0, Math.min(clipEndUs(clip) - pointerUs, dur));
    const inn = clip.fade?.inUs ?? 0;
    clip.fade = { inUs: inn, outUs: Math.min(outUs, dur - inn) };
    return;
  }
}

/** Blende auf neue Cliplänge begrenzen (nach Trim). */
function clampFade(clip: Clip): void {
  if (!clip.fade) return;
  const dur = clipDurationUs(clip);
  const inUs = Math.max(0, Math.min(clip.fade.inUs, dur));
  const outUs = Math.max(0, Math.min(clip.fade.outUs, dur - inUs));
  clip.fade = inUs === 0 && outUs === 0 ? undefined : { inUs, outUs };
}

function setClipGain(draft: Project, clipId: string, gain: number): void {
  const loc = findClip(draft, clipId);
  if (loc) loc.clip.gain = Math.max(0, Math.min(GAIN_MAX, gain));
}

/** Trim-Kante beim Loslassen auf den nächsten Nulldurchgang rasten. */
function snapTrimToZero(draft: Project, clipId: string, mode: 'trim-l' | 'trim-r'): void {
  const loc = findClip(draft, clipId);
  if (!loc) return;
  const { clip } = loc;
  if (mode === 'trim-l') {
    const snapped = snapSourceUsToZero(clip.assetId, clip.inUs);
    const bounded = Math.max(0, Math.min(snapped, clip.outUs - MIN_DUR_US));
    const delta = bounded - clip.inUs;
    clip.inUs = bounded;
    clip.startUs = Math.max(0, clip.startUs + delta);
  } else {
    const snapped = snapSourceUsToZero(clip.assetId, clip.outUs);
    clip.outUs = Math.max(clip.inUs + MIN_DUR_US, snapped);
  }
  clampFade(clip);
}

function findClip(project: Project, clipId: string): { track: Track; clip: Clip } | null {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

function laneIndexOfClip(lanes: Track[], clipId: string): number {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i].clips.some((c) => c.id === clipId)) return i;
  }
  return -1;
}

/** Automationspunkt verschieben; us zwischen Nachbarn geklemmt (Reihenfolge bleibt). */
function moveAutoPoint(draft: Project, drag: DragState, us: number, value: number): void {
  const t = draft.tracks.find((tt) => tt.id === drag.autoTrackId);
  const arr = drag.autoParam ? t?.automation?.[drag.autoParam] : undefined;
  if (!arr || drag.autoIndex === undefined) return;
  const i = drag.autoIndex;
  if (i < 0 || i >= arr.length) return;
  const lo = i > 0 ? arr[i - 1].us + 1 : 0;
  const hi = i < arr.length - 1 ? arr[i + 1].us - 1 : Number.MAX_SAFE_INTEGER;
  arr[i].us = Math.max(lo, Math.min(hi, Math.round(us)));
  arr[i].value = value;
}

// ── Sub-Komponenten ───────────────────────────────────────────────────────────

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

function TrackHeader({
  track,
  active,
  removable,
  autoParam,
  onCycleAuto,
  onClearAuto,
}: {
  track: Track;
  active: boolean;
  removable: boolean;
  autoParam?: AutoParam;
  onCycleAuto: () => void;
  onClearAuto: () => void;
}) {
  const setActiveTrack = useProject((s) => s.setActiveTrack);
  const removeTrack = useProject((s) => s.removeTrack);
  const toggleMute = useProject((s) => s.toggleMute);
  const toggleSolo = useProject((s) => s.toggleSolo);
  const renameTrack = useProject((s) => s.renameTrack);

  return (
    <div
      onPointerDown={() => setActiveTrack(track.id)}
      title="Klick: als Ziel-Spur wählen (Import/Aufnahme landet hier)"
      className={cn(
        'group flex flex-col justify-center gap-1 px-2 border-b border-[var(--border)]/30 cursor-pointer',
        active && 'bg-[var(--primary)]/10 border-l-2 border-l-[var(--primary)]',
      )}
      style={{ height: TRACK_H }}
    >
      <div className="flex items-center gap-1">
        <input
          value={track.name}
          onChange={(e) => renameTrack(track.id, e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="bg-transparent text-[11px] font-bold truncate w-[84px] outline-none focus:bg-[var(--background)] rounded px-1"
        />
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
        <MiniToggle active={track.muted} label="M" title="Stumm" tone="mute" onClick={() => toggleMute(track.id)} />
        <MiniToggle active={track.solo} label="S" title="Solo" tone="solo" onClick={() => toggleSolo(track.id)} />
        <button
          type="button"
          title="Automation: aus → Vol → Pan"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onCycleAuto}
          className={cn(
            'h-5 px-1.5 rounded text-[9px] font-bold ml-auto',
            autoParam ? 'bg-amber-400 text-black' : 'border border-[var(--border)] text-[var(--muted-foreground)]',
          )}
        >
          {autoParam === 'gain' ? 'A·Vol' : autoParam === 'pan' ? 'A·Pan' : 'A'}
        </button>
        {autoParam && (
          <button
            type="button"
            title="Automation dieser Kurve löschen"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClearAuto}
            className="h-5 w-5 rounded text-[10px] text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
          >
            ⌫
          </button>
        )}
      </div>
    </div>
  );
}

function MiniToggle({
  active,
  label,
  title,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  title: string;
  tone: 'mute' | 'solo';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cn(
        'w-5 h-5 rounded text-[10px] font-bold',
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

function ClipBlock({
  clip,
  project,
  selected,
  leftPx,
  widthPx,
  onStart,
}: {
  clip: Clip;
  project: Project;
  selected: boolean;
  leftPx: number;
  widthPx: number;
  onStart: (e: React.PointerEvent, mode: DragMode) => void;
}) {
  const asset = project.assets.find((a) => a.id === clip.assetId);
  const label = asset?.fileName ?? 'Clip';
  const durUs = Math.max(1, clipDurationUs(clip));
  const pxPerUs = widthPx / durUs;
  const fadeInPx = Math.min(widthPx, (clip.fade?.inUs ?? 0) * pxPerUs);
  const fadeOutPx = Math.min(widthPx, (clip.fade?.outUs ?? 0) * pxPerUs);
  const gainTopPct = (1 - Math.min(1, clip.gain / GAIN_MAX)) * 100;

  return (
    <div
      onPointerDown={(e) => onStart(e, 'move')}
      className={cn(
        'absolute top-1 bottom-1 rounded-md border overflow-hidden cursor-grab active:cursor-grabbing select-none',
        'bg-emerald-500/20 border-emerald-400/60',
        selected && 'ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--background)]',
      )}
      style={{ left: leftPx, width: widthPx }}
      title={label}
    >
      <div className="absolute inset-0 pointer-events-none">
        <ClipWave asset={asset} clip={clip} widthPx={widthPx} />
      </div>

      {/* Fade-Rampen (Verlauf + Diagonale) */}
      {fadeInPx > 1 && (
        <div className="absolute top-0 bottom-0 left-0 pointer-events-none" style={{ width: fadeInPx, background: 'linear-gradient(to right, rgba(0,0,0,0.55), transparent)' }} />
      )}
      {fadeOutPx > 1 && (
        <div className="absolute top-0 bottom-0 right-0 pointer-events-none" style={{ width: fadeOutPx, background: 'linear-gradient(to left, rgba(0,0,0,0.55), transparent)' }} />
      )}
      {(fadeInPx > 1 || fadeOutPx > 1) && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox={`0 0 ${widthPx} 100`}>
          {fadeInPx > 1 && <line x1={0} y1={100} x2={fadeInPx} y2={0} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />}
          {fadeOutPx > 1 && <line x1={widthPx - fadeOutPx} y1={0} x2={widthPx} y2={100} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />}
        </svg>
      )}

      {/* Gain-Linie (vertikal ziehen) */}
      <div
        onPointerDown={(e) => onStart(e, 'gain')}
        title={`Pegel ziehen · ${clip.gain.toFixed(2)}×`}
        className="absolute left-0 right-0 h-2 -translate-y-1/2 cursor-ns-resize group/gain"
        style={{ top: `${gainTopPct}%` }}
      >
        <div className="absolute left-1 right-1 top-1/2 h-px bg-amber-300/80 group-hover/gain:bg-amber-300" />
      </div>

      {/* Trim-Kanten */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 hover:bg-[var(--primary)]" onPointerDown={(e) => onStart(e, 'trim-l')} />
      <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 hover:bg-[var(--primary)]" onPointerDown={(e) => onStart(e, 'trim-r')} />

      {/* Fade-Griffe (obere Ecken, über den Trim-Kanten) */}
      <div
        onPointerDown={(e) => onStart(e, 'fade-l')}
        title="Einblende ziehen"
        className="absolute top-0 left-0 w-3 h-3 cursor-pointer bg-amber-300/70 hover:bg-amber-300 rounded-br-md"
        style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
      />
      <div
        onPointerDown={(e) => onStart(e, 'fade-r')}
        title="Ausblende ziehen"
        className="absolute top-0 right-0 w-3 h-3 cursor-pointer bg-amber-300/70 hover:bg-amber-300 rounded-bl-md"
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}
      />

      <div className="px-2 pt-1 h-full pointer-events-none">
        <span className="text-[10px] font-semibold truncate drop-shadow block ml-3">{label}</span>
      </div>
    </div>
  );
}

/** Zeichnet die Wellenform des Clip-Ausschnitts [inUs,outUs] auf ein Canvas. */
function ClipWave({ asset, clip, widthPx }: { asset: MediaAsset | undefined; clip: Clip; widthPx: number }) {
  const peaks = useWaveform(asset);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h = TRACK_H - 10;
  const w = Math.max(1, Math.floor(widthPx));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!peaks || peaks.length === 0) return;

    const inSec = usToSec(clip.inUs);
    const durSec = usToSec(clipDurationUs(clip));
    const mid = h / 2;
    ctx.fillStyle = 'rgba(110, 231, 183, 0.85)';
    for (let x = 0; x < w; x++) {
      const srcSec = inSec + (x / w) * durSec;
      const idx = Math.floor(srcSec * PEAKS_PER_SEC);
      const peak = idx >= 0 && idx < peaks.length ? peaks[idx] : 0;
      const half = Math.max(0.5, peak * (mid - 1));
      ctx.fillRect(x, mid - half, 1, half * 2);
    }
  }, [peaks, w, h, clip.inUs, clip.outUs]);

  return <canvas ref={canvasRef} width={w} height={h} className="absolute top-[5px] left-0" style={{ width: w, height: h }} />;
}

/** Editierbare Automations-Hüllkurve über einer Spur-Lane (Vol/Pan). */
function AutomationOverlay({
  points,
  param,
  widthPx,
  toX,
  onAdd,
  onPointDown,
  onPointRemove,
}: {
  points: AutomationPoint[];
  param: AutoParam;
  widthPx: number;
  toX: (us: number) => number;
  onAdd: (clientX: number, clientY: number) => void;
  onPointDown: (e: React.PointerEvent, index: number) => void;
  onPointRemove: (index: number) => void;
}) {
  const H = TRACK_H;
  const toY = (value: number): number =>
    param === 'gain'
      ? (1 - Math.min(1, Math.max(0, value / GAIN_MAX))) * H
      : ((1 - Math.max(-1, Math.min(1, value))) / 2) * H;
  const neutralY = toY(param === 'gain' ? 1 : 0);

  let d = '';
  if (points.length) {
    const first = points[0];
    d = `M 0 ${toY(first.value)} L ${toX(first.us)} ${toY(first.value)}`;
    for (let i = 1; i < points.length; i++) d += ` L ${toX(points[i].us)} ${toY(points[i].value)}`;
    d += ` L ${widthPx} ${toY(points[points.length - 1].value)}`;
  }

  return (
    <svg className="absolute left-0 top-0" width={widthPx} height={H} style={{ width: widthPx, height: H }}>
      <rect
        x={0}
        y={0}
        width={widthPx}
        height={H}
        fill="transparent"
        style={{ cursor: 'crosshair' }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          onAdd(e.clientX, e.clientY);
        }}
      />
      <line x1={0} y1={neutralY} x2={widthPx} y2={neutralY} stroke="rgba(251,191,36,0.25)" strokeWidth={1} strokeDasharray="3 3" />
      {d && <path d={d} fill="none" stroke="rgb(251,191,36)" strokeWidth={1.5} />}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={toX(p.us)}
          cy={toY(p.value)}
          r={4}
          fill="rgb(251,191,36)"
          stroke="black"
          strokeWidth={0.5}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => onPointDown(e, i)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onPointRemove(i);
          }}
        />
      ))}
      <text x={4} y={12} fill="rgba(251,191,36,0.85)" fontSize={9} fontWeight="bold" style={{ pointerEvents: 'none' }}>
        {param === 'gain' ? 'Vol' : 'Pan'}
      </text>
    </svg>
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

function TlToggle({ label, active, onClick, title }: { label: string; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'h-7 px-2.5 rounded-[var(--radius)] text-[11px] font-bold transition-colors whitespace-nowrap border',
        active
          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
          : 'border-[var(--border)] text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}
