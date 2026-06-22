// Wellenform-Peaks aus einem AudioBuffer — eine Spitzen-Amplitude (0..1) pro
// Zeit-Bucket, samplerate-/zoomunabhängig. Die Timeline mappt den Clip-Ausschnitt
// [inUs,outUs] auf den passenden Peak-Bereich.
import type { MediaAsset } from '@shared/project';
import { decodeAsset } from './decode';

/** Buckets pro Sekunde — fein genug für flüssiges Zeichnen, klein genug im Speicher. */
export const PEAKS_PER_SEC = 240;

/** Abs-Spitze (über alle Kanäle gemixt) je Bucket. */
export function computePeaks(buffer: AudioBuffer, peaksPerSec = PEAKS_PER_SEC): Float32Array {
  const per = Math.max(1, Math.floor(buffer.sampleRate / peaksPerSec));
  const len = buffer.length;
  const buckets = Math.max(1, Math.ceil(len / per));
  const out = new Float32Array(buckets);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let b = 0; b < buckets; b++) {
      let peak = out[b];
      const start = b * per;
      const end = Math.min(len, start + per);
      for (let i = start; i < end; i++) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
      out[b] = peak;
    }
  }
  return out;
}

const peakCache = new Map<string, Float32Array>();
const pending = new Map<string, Promise<Float32Array>>();

export function cachedPeaks(assetId: string): Float32Array | undefined {
  return peakCache.get(assetId);
}

/** Peaks für ein Asset sicherstellen (dekodiert bei Bedarf). */
export function ensurePeaks(asset: MediaAsset): Promise<Float32Array> {
  const cached = peakCache.get(asset.id);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(asset.id);
  if (!p) {
    p = (async () => {
      const buffer = await decodeAsset(asset);
      const peaks = computePeaks(buffer);
      peakCache.set(asset.id, peaks);
      pending.delete(asset.id);
      return peaks;
    })();
    pending.set(asset.id, p);
  }
  return p;
}
