/** Natives NDI-Addon (Send + Receive). Alle Aufrufe sind synchron. */

// ===================== Send =====================

/** NDI-Runtime initialisieren. Muss vor allem anderen laufen. */
export function init(): boolean;

/** Einen NDI-Sender mit sichtbarem Quellnamen erstellen. */
export function createSender(name: string): void;

/** Ein BGRA-Vollbild (tight packed, stride = width*4) senden. */
export function sendVideoBGRA(
  buf: Uint8Array,
  width: number,
  height: number,
  fpsN?: number,
  fpsD?: number,
): void;

/** Audio als float32-planar (FLTP) senden. Layout: [ch0 samples][ch1 samples]… */
export function sendAudioFLTP(
  planar: Float32Array,
  channels: number,
  samples: number,
  sampleRate?: number,
): void;

/** Anzahl aktuell verbundener NDI-Empfänger. */
export function connections(timeoutMs?: number): number;

// ===================== Receive =====================

export interface NdiVideoFrame {
  type: 'video';
  /** BGRA/BGRX, Länge = lineStride * height. Kopie — bleibt nach dem Aufruf gültig. */
  data: Buffer;
  width: number;
  height: number;
  lineStride: number;
  /** NDI-FourCC der gelieferten Pixel (BGRA/BGRX wurde angefordert). */
  fourCC: number;
  fpsN: number;
  fpsD: number;
}

export interface NdiAudioFrame {
  type: 'audio';
  /** float32-planar (FLTP): [ch0 samples][ch1 samples]… — Kopie. */
  data: Float32Array;
  channels: number;
  samples: number;
  sampleRate: number;
}

export type NdiFrame = NdiVideoFrame | NdiAudioFrame;

/** Sichtbare NDI-Quellen im Netz auflisten (Quellnamen). */
export function findSources(timeoutMs?: number): string[];

/** Mit einer Quelle (per Name aus findSources) verbinden. */
export function createReceiver(sourceName: string): boolean;

/**
 * Den nächsten Frame holen (Polling). Liefert ein Video- oder Audio-Frame oder
 * `null`, wenn innerhalb von `timeoutMs` nichts kam. In einer Schleife aufrufen
 * (z. B. im utilityProcess).
 */
export function receive(timeoutMs?: number): NdiFrame | null;

/** Receiver trennen/zerstören. */
export function closeReceiver(): void;

// ===================== Teardown =====================

/** Sender + Receiver zerstören und NDI-Runtime herunterfahren. */
export function destroy(): void;
