import { useEffect, useState, type RefObject } from 'react';

/**
 * Misst den Container und liefert die größte Box mit Seitenverhältnis `aspect`,
 * die vollständig hineinpasst (Letterbox-Fit). So überläuft die Vorschau nie die
 * Spalte — egal wie schmal/hoch sie wird.
 */
export function useFitBox(ref: RefObject<HTMLElement | null>, aspect: number): { w: number; h: number } {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw <= 0 || ch <= 0 || !Number.isFinite(aspect) || aspect <= 0) return;
      let w = cw;
      let h = w / aspect;
      if (h > ch) {
        h = ch;
        w = h * aspect;
      }
      setBox({ w: Math.round(w), h: Math.round(h) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, aspect]);
  return box;
}
