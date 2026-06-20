import { useEffect, useRef } from 'react';
import { cn } from '@jm/ui';
import { projectDurationUs, secToUs } from '@shared/project';
import { useProject } from '@/store/project';
import { activeTitles, activeVideoClip, playbackUrl, sourceTimeSec } from '@/lib/playback';
import { drawTitle } from '@/lib/title-render';
import { formatTimecode } from '@/lib/format';

export function PreviewMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const lastUrlRef = useRef<string>('');

  const playing = useProject((s) => s.playing);
  const setPlaying = useProject((s) => s.setPlaying);
  const setPlayhead = useProject((s) => s.setPlayhead);
  const playheadUs = useProject((s) => s.playheadUs);
  const present = useProject((s) => s.present);
  const totalUs = projectDurationUs(present);

  // ── Scrub (pausiert): Video an Playhead anlegen ───────────────────────────
  useEffect(() => {
    if (playing) return;
    const video = videoRef.current;
    if (!video) return;
    const active = activeVideoClip(present, playheadUs);
    if (!active) {
      video.pause();
      lastUrlRef.current = '';
      return;
    }
    const url = playbackUrl(active.asset);
    if (url !== lastUrlRef.current) {
      video.src = url;
      lastUrlRef.current = url;
    }
    const t = sourceTimeSec(active.clip, playheadUs);
    if (Math.abs(video.currentTime - t) > 0.05) video.currentTime = t;
  }, [playheadUs, playing, present]);

  // ── Wiedergabe: Wall-Clock treibt den Playhead, Video folgt ───────────────
  useEffect(() => {
    if (!playing) {
      videoRef.current?.pause();
      cancelAnimationFrame(rafRef.current);
      return;
    }
    lastTsRef.current = performance.now();
    const tick = (ts: number): void => {
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const st = useProject.getState();
      const dur = projectDurationUs(st.present);
      let head = st.playheadUs + secToUs(dt);
      if (head >= dur) {
        head = dur;
        st.setPlayhead(head);
        st.setPlaying(false);
        return;
      }
      st.setPlayhead(head);

      const video = videoRef.current;
      if (video) {
        const active = activeVideoClip(st.present, head);
        if (!active) {
          if (!video.paused) video.pause();
          lastUrlRef.current = '';
        } else {
          const url = playbackUrl(active.asset);
          if (url !== lastUrlRef.current) {
            video.src = url;
            lastUrlRef.current = url;
            video.currentTime = sourceTimeSec(active.clip, head);
          }
          const expected = sourceTimeSec(active.clip, head);
          if (Math.abs(video.currentTime - expected) > 0.3) video.currentTime = expected;
          if (video.paused) void video.play().catch(() => {});
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  // ── Titel-Overlay zeichnen ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(2, Math.round(rect.width));
    const H = Math.max(2, Math.round(rect.height));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (const clip of activeTitles(present, playheadUs)) {
      if (clip.title) drawTitle(ctx, clip.title, W, H);
    }
  }, [playheadUs, present]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)] border-b border-[var(--border)]/40">
        Programm
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black/50 p-3">
        <div className="relative w-full h-full max-w-full" style={{ aspectRatio: `${present.export.width} / ${present.export.height}` }}>
          <div className="absolute inset-0 m-auto h-full flex items-center justify-center">
            <div className="relative h-full" style={{ aspectRatio: `${present.export.width} / ${present.export.height}` }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain bg-black" muted={playing} />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="h-11 shrink-0 flex items-center justify-center gap-3 border-t border-[var(--border)]/50 bg-[var(--card)]/40">
        <TransportButton label="⏮" title="Zum Anfang" onClick={() => setPlayhead(0)} />
        <TransportButton
          label={playing ? '⏸' : '▶'}
          title="Wiedergabe / Pause"
          primary
          onClick={() => setPlaying(!playing)}
        />
        <TransportButton label="⏭" title="Zum Ende" onClick={() => setPlayhead(totalUs)} />
        <span className="ml-3 font-mono text-xs tabular-nums text-[var(--foreground)]/90">
          {formatTimecode(playheadUs)}
          <span className="text-[var(--muted-foreground)]"> / {formatTimecode(totalUs)}</span>
        </span>
      </div>
    </div>
  );
}

function TransportButton({
  label,
  title,
  onClick,
  primary,
}: {
  label: string;
  title: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'h-8 min-w-9 px-2 rounded-[var(--radius)] text-sm font-bold transition-colors',
        primary
          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90'
          : 'border border-[var(--border)] text-[var(--foreground)]/85 hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}
