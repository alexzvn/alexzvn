import { useEffect, useState } from 'react';

// Module-level cache so the (potentially slow) system font enumeration runs once.
let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

/** Font family names installed on the machine (empty until loaded / in browser). */
export function useFonts(): string[] {
  const [fonts, setFonts] = useState<string[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setFonts(cache);
      return;
    }
    if (!window.jmg?.fonts) return;
    inflight ??= window.jmg.fonts
      .list()
      .then((list) => {
        cache = list;
        return list;
      })
      .catch(() => {
        cache = [];
        return [];
      });
    let alive = true;
    inflight.then((list) => alive && setFonts(list));
    return () => {
      alive = false;
    };
  }, []);

  return fonts;
}
