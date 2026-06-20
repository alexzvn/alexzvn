import { closeSync, openSync, writeSync } from 'node:fs';
import path from 'node:path';

/**
 * Schlanker WAV-Writer (32-bit float, IEEE, mehrkanalig, interleaved). Verlustfrei
 * — die Audio-Frames sind bereits float. Öffnet in Reaper/Audacity. fd-basiert,
 * damit der Header am Ende mit den echten Größen gepatcht werden kann.
 *
 * Limitierung v0.1: Standard-WAV (32-bit-Größenfelder) → max ~4 GB pro Datei.
 * RF64/W64 für längere Mehrkanal-Mitschnitte kommt in v0.2.
 */
export class WavWriter {
  private fd: number;
  private dataBytes = 0;
  readonly channels: number;
  readonly sampleRate: number;

  constructor(filePath: string, channels: number, sampleRate: number) {
    this.channels = channels;
    this.sampleRate = sampleRate;
    this.fd = openSync(filePath, 'w');
    writeSync(this.fd, this.header(0)); // Platzhalter-Header
  }

  /** planar [ch0:frames][ch1:frames]… → interleaved float32 LE anhängen. */
  writeBlock(planar: Float32Array, channels: number, frames: number): void {
    const buf = Buffer.allocUnsafe(channels * frames * 4);
    let o = 0;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        buf.writeFloatLE(planar[c * frames + i], o);
        o += 4;
      }
    }
    writeSync(this.fd, buf);
    this.dataBytes += buf.length;
  }

  /** Header mit echten Größen überschreiben + Datei schließen. */
  finalize(): { bytes: number; durationSec: number } {
    const header = this.header(this.dataBytes);
    writeSync(this.fd, header, 0, header.length, 0); // an Offset 0
    closeSync(this.fd);
    const frames = this.dataBytes / (this.channels * 4);
    return {
      bytes: this.dataBytes + 44,
      durationSec: this.sampleRate ? frames / this.sampleRate : 0,
    };
  }

  private header(dataBytes: number): Buffer {
    const ch = this.channels;
    const sr = this.sampleRate;
    const blockAlign = ch * 4;
    const b = Buffer.alloc(44);
    b.write('RIFF', 0, 'ascii');
    b.writeUInt32LE(36 + dataBytes, 4);
    b.write('WAVE', 8, 'ascii');
    b.write('fmt ', 12, 'ascii');
    b.writeUInt32LE(16, 16); // fmt-Chunk-Größe
    b.writeUInt16LE(3, 20); // audioFormat 3 = IEEE float
    b.writeUInt16LE(ch, 22);
    b.writeUInt32LE(sr, 24);
    b.writeUInt32LE(sr * blockAlign, 28); // byteRate
    b.writeUInt16LE(blockAlign, 32);
    b.writeUInt16LE(32, 34); // bits per sample
    b.write('data', 36, 'ascii');
    b.writeUInt32LE(dataBytes, 40);
    return b;
  }
}

/**
 * Schreibt zusätzlich jede Spur als eigene Mono-WAV in einen Ordner (Issue #20).
 * Demultiplext die planaren Frames ([ch0:frames][ch1:frames]…) auf je einen
 * WavWriter pro Kanal — parallel zur kombinierten Mehrkanal-Datei.
 */
export class MultiWavWriter {
  private readonly writers: WavWriter[];

  constructor(dir: string, baseName: string, channels: number, sampleRate: number) {
    this.writers = Array.from(
      { length: channels },
      (_, c) =>
        new WavWriter(
          path.join(dir, `${baseName}-Spur${String(c + 1).padStart(2, '0')}.wav`),
          1,
          sampleRate,
        ),
    );
  }

  writeBlock(planar: Float32Array, channels: number, frames: number): void {
    const n = Math.min(channels, this.writers.length);
    for (let c = 0; c < n; c++) {
      // Mono-Slice des Kanals als 1-Kanal-Block schreiben.
      const mono = planar.subarray(c * frames, c * frames + frames);
      this.writers[c].writeBlock(mono, 1, frames);
    }
  }

  /** Alle Spuren best-effort finalisieren (eine kaputte Spur bricht nicht alle ab). */
  finalize(): void {
    for (const w of this.writers) {
      try {
        w.finalize();
      } catch {
        // ignore
      }
    }
  }
}
