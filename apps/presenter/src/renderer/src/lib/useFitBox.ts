import { useEffect, useState, type RefObject } from 'react';

export interface Box {
  w: number;
  h: number;
}

/**
 * Measures a container and returns the largest box of the given aspect ratio
 * that fits inside it (letterbox). Used to align interactive DOM overlays with
 * the rendered slide pixel-for-pixel.
 */
export function useFitBox(ref: RefObject<HTMLElement>, aspect: number): Box {
  const [box, setBox] = useState<Box>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw <= 0 || ch <= 0 || !Number.isFinite(aspect) || aspect <= 0) return;
      let w = cw;
      let h = cw / aspect;
      if (h > ch) {
        h = ch;
        w = ch * aspect;
      }
      setBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, aspect]);

  return box;
}
