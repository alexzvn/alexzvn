// Dekodierung von Audioquellen → AudioBuffer (gecacht je Asset.id).
// Browser-dekodierbare Formate (wav/mp3/flac/aac/ogg) gehen direkt über
// decodeAudioData; exotische Quellen lässt der Main nach 48-kHz-Float-WAV
// transkodieren (Proxy-Muster wie im JM Editor).
import { mediaUrl } from '@shared/media-url';
import { DEFAULT_SAMPLE_RATE, type MediaAsset } from '@shared/project';

let sharedCtx: AudioContext | null = null;

/** Gemeinsamer AudioContext (48 kHz) für Wiedergabe + Dekodierung. */
export function audioContext(): AudioContext {
  if (!sharedCtx) {
    sharedCtx = new AudioContext({ sampleRate: DEFAULT_SAMPLE_RATE });
  }
  return sharedCtx;
}

const bufferCache = new Map<string, AudioBuffer>();

export function cachedBuffer(assetId: string): AudioBuffer | undefined {
  return bufferCache.get(assetId);
}

async function fetchArrayBuffer(path: string): Promise<ArrayBuffer> {
  const res = await fetch(mediaUrl(path));
  if (!res.ok) throw new Error(`Datei nicht ladbar (${res.status})`);
  return res.arrayBuffer();
}

async function decodePath(ctx: BaseAudioContext, path: string): Promise<AudioBuffer> {
  const ab = await fetchArrayBuffer(path);
  // decodeAudioData detacht den ArrayBuffer — ok, er wird nicht weiterverwendet.
  return ctx.decodeAudioData(ab);
}

async function loadAndDecode(asset: MediaAsset): Promise<AudioBuffer> {
  const ctx = audioContext();
  // 1) Bereits transkodierter Proxy vorhanden → direkt nehmen.
  if (asset.proxyPath) return decodePath(ctx, asset.proxyPath);

  // 2) Direktes Dekodieren versuchen (außer als exotisch markiert).
  if (!asset.needsTranscode) {
    try {
      return await decodePath(ctx, asset.path);
    } catch {
      // Fällt durch zum Transkodieren.
    }
  }

  // 3) Vom Main nach dekodierbarem WAV transkodieren lassen + erneut versuchen.
  const res = await window.jmdaw.media.transcodeForDecode(asset);
  if (!res.ok || !res.proxyPath) {
    throw new Error(res.error ?? 'Dekodierung fehlgeschlagen');
  }
  return decodePath(ctx, res.proxyPath);
}

/** Asset dekodieren (oder aus dem Cache liefern). */
export async function decodeAsset(asset: MediaAsset): Promise<AudioBuffer> {
  const cached = bufferCache.get(asset.id);
  if (cached) return cached;
  const buffer = await loadAndDecode(asset);
  bufferCache.set(asset.id, buffer);
  return buffer;
}
