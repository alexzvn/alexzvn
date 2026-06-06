import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Overlay, Slide } from '@shared/types';
import { renderBase } from '@/lib/pdf';
import { imageObjectUrl } from '@/lib/assets';
import { FONT_FAMILY } from '@/lib/paint';
import { useFitBox } from '@/lib/useFitBox';
import { useProject } from '@/store/project';

interface Props {
  slide: Slide;
}

/**
 * The interactive editing surface: the base page on a canvas, with overlays as
 * draggable/resizable DOM elements aligned to the rendered slide box. Overlays
 * use the same normalised geometry the canvas painter uses, so the editor and
 * the audience/export look the same.
 */
export function EditorStage({ slide }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const box = useFitBox(containerRef, aspect);
  const selectOverlay = useProject((s) => s.selectOverlay);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const base = await renderBase(slide.sourceId, slide.pageIndex, 1280);
        if (cancelled) return;
        setAspect(base.aspect);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = base.width;
        canvas.height = base.height;
        canvas.getContext('2d')?.drawImage(base.canvas, 0, 0);
      } catch {
        // surfaced by SlideCanvas elsewhere; keep the stage usable for overlays
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slide.sourceId, slide.pageIndex]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) selectOverlay(null);
      }}
    >
      <div
        className="relative shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-[var(--border)]"
        style={{ width: box.w, height: box.h }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-white" />
        {slide.overlays.map((o) => (
          <OverlayBox key={o.id} slide={slide} overlay={o} box={box} />
        ))}
      </div>
    </div>
  );
}

type DragMode = 'move' | 'resize' | null;

function OverlayBox({ slide, overlay, box }: { slide: Slide; overlay: Overlay; box: { w: number; h: number } }) {
  const selected = useProject((s) => s.selectedOverlayId === overlay.id);
  const selectOverlay = useProject((s) => s.selectOverlay);
  const updateOverlay = useProject((s) => s.updateOverlay);
  const mode = useRef<DragMode>(null);
  const start = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });

  const onPointerDown = (e: RPointerEvent, m: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    selectOverlay(overlay.id);
    mode.current = m;
    start.current = { px: e.clientX, py: e.clientY, x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!mode.current || box.w === 0) return;
    const dnx = (e.clientX - start.current.px) / box.w;
    const dny = (e.clientY - start.current.py) / box.h;
    if (mode.current === 'move') {
      const x = Math.max(0, Math.min(start.current.x + dnx, 1 - overlay.w));
      const y = Math.max(0, Math.min(start.current.y + dny, 1 - overlay.h));
      updateOverlay(slide.id, overlay.id, { x, y });
    } else {
      const w = Math.max(0.04, Math.min(start.current.w + dnx, 1 - overlay.x));
      const h = Math.max(0.03, Math.min(start.current.h + dny, 1 - overlay.y));
      updateOverlay(slide.id, overlay.id, { w, h });
    }
  };

  const onPointerUp = (e: RPointerEvent) => {
    mode.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const fontPx = (overlay.fontFrac ?? 0.06) * box.h;

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute cursor-move select-none"
      style={{
        left: `${overlay.x * 100}%`,
        top: `${overlay.y * 100}%`,
        width: `${overlay.w * 100}%`,
        height: `${overlay.h * 100}%`,
        transform: overlay.rotation ? `rotate(${overlay.rotation}deg)` : undefined,
        outline: selected ? '2px solid var(--primary)' : '1px dashed rgba(255,255,255,0.35)',
        outlineOffset: 0,
      }}
    >
      {overlay.kind === 'text' ? (
        <div
          className="w-full h-full flex flex-col justify-center overflow-hidden"
          style={{
            background: overlay.background ?? 'transparent',
            color: overlay.color ?? '#ffffff',
            fontFamily: FONT_FAMILY,
            fontWeight: overlay.bold ? 700 : 500,
            fontSize: `${fontPx}px`,
            lineHeight: 1.2,
            textAlign: overlay.align ?? 'left',
            padding: `${fontPx * 0.25}px`,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {overlay.text}
        </div>
      ) : (
        <img
          src={overlay.imageId ? imageObjectUrl(overlay.imageId) : undefined}
          alt=""
          draggable={false}
          className="w-full h-full object-contain pointer-events-none"
        />
      )}

      {selected && (
        <span
          onPointerDown={(e) => onPointerDown(e, 'resize')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-sm bg-[var(--primary)] cursor-nwse-resize"
        />
      )}
    </div>
  );
}
