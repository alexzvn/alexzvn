// Reine Audio-Helfer (keine node/electron-Imports) → per Selftest prüfbar.

/**
 * Float32-PCM (mono, [-1,1]) in eine 16-bit-PCM-WAV-Datei (Bytes) kodieren.
 * whisper.cpp liest 16-kHz-Mono-WAV direkt — der Renderer liefert genau das
 * (AudioContext @ 16 kHz).
 */
export function floatToWav16(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const wstr = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  wstr(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  wstr(8, 'WAVE');
  wstr(12, 'fmt ');
  dv.setUint32(16, 16, true); // fmt-Chunk-Größe
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true); // Byte-Rate (mono × 2 Byte)
  dv.setUint16(32, 2, true); // Block-Align
  dv.setUint16(34, 16, true); // Bits/Sample
  wstr(36, 'data');
  dv.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buf);
}

/** Lautstärke (RMS) eines Float32-Blocks — für die Stille-/Sprach-Erkennung. */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}
