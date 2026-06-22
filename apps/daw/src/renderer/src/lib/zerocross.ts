// Snap einer Quell-Position (µs innerhalb eines Assets) auf den nächsten
// Audio-Nulldurchgang → klickfreie Schnitte/Trims. Nutzt den bereits dekodierten
// AudioBuffer (Cache aus decode.ts); ohne Buffer bleibt die Position unverändert.
import { secToUs, usToSec } from '@shared/project';
import { cachedBuffer } from '@/audio/decode';

/** Suchfenster um die Zielposition (±10 ms). */
const WINDOW_SEC = 0.01;

/**
 * Liefert die Quell-Position (µs) des nächstgelegenen Nulldurchgangs in Kanal 0,
 * innerhalb von ±WINDOW_SEC. Findet sich keiner, kommt die Eingabe zurück.
 */
export function snapSourceUsToZero(assetId: string, sourceUs: number): number {
  const buf = cachedBuffer(assetId);
  if (!buf) return sourceUs;
  const sr = buf.sampleRate;
  const data = buf.getChannelData(0);
  const center = Math.round(usToSec(sourceUs) * sr);
  const win = Math.round(WINDOW_SEC * sr);
  const lo = Math.max(1, center - win);
  const hi = Math.min(data.length - 1, center + win);

  let best = -1;
  let bestDist = Infinity;
  for (let i = lo; i <= hi; i++) {
    const a = data[i - 1];
    const b = data[i];
    // Vorzeichenwechsel (inkl. Berührung der Nulllinie).
    const crosses = (a <= 0 && b > 0) || (a >= 0 && b < 0) || b === 0;
    if (crosses) {
      const d = Math.abs(i - center);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  }
  if (best < 0) return sourceUs;
  return Math.max(0, secToUs(best / sr));
}
