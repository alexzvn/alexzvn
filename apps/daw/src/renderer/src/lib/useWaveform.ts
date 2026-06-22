import { useEffect, useState } from 'react';
import type { MediaAsset } from '@shared/project';
import { cachedPeaks, ensurePeaks } from '@/audio/waveform';

/** Liefert die Wellenform-Peaks eines Assets (dekodiert/berechnet bei Bedarf). */
export function useWaveform(asset: MediaAsset | undefined): Float32Array | null {
  const [peaks, setPeaks] = useState<Float32Array | null>(
    asset ? cachedPeaks(asset.id) ?? null : null,
  );

  useEffect(() => {
    if (!asset) {
      setPeaks(null);
      return;
    }
    const cached = cachedPeaks(asset.id);
    if (cached) {
      setPeaks(cached);
      return;
    }
    let alive = true;
    void ensurePeaks(asset)
      .then((p) => {
        if (alive) setPeaks(p);
      })
      .catch(() => {
        if (alive) setPeaks(null);
      });
    return () => {
      alive = false;
    };
  }, [asset?.id]);

  return peaks;
}
