/** Natives NDI-Send-Addon. Alle Aufrufe sind synchron. */

/** NDI-Runtime initialisieren. Muss vor createSender() laufen. */
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

/** Sender zerstören und NDI-Runtime herunterfahren. */
export function destroy(): void;
