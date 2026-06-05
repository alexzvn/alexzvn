// Orchestrator: ties a MediaStream's video + audio into the flash and beep
// detectors, feeds both into the correlator, and emits live measurement updates.

import type { MeasurementStats, SyncSample } from '@shared/types';
import { FlashDetector } from './video-flash';
import { AudioOnsetDetector } from './audio-onset';
import { Correlator } from './correlator';

export interface SyncMeterUpdate {
  stats: MeasurementStats | null;
  samples: SyncSample[];
}

export interface SyncMeterOptions {
  /** Reference beep frequency to lock onto (Hz). */
  targetFreq: number;
}

export const DEFAULT_METER_OPTIONS: SyncMeterOptions = { targetFreq: 1000 };

export class SyncMeter {
  private flash: FlashDetector | null = null;
  private audio: AudioOnsetDetector | null = null;
  private readonly correlator = new Correlator();
  private opts: SyncMeterOptions;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onUpdate: (update: SyncMeterUpdate) => void,
    opts: Partial<SyncMeterOptions> = {},
  ) {
    this.opts = { ...DEFAULT_METER_OPTIONS, ...opts };
  }

  async start(stream: MediaStream): Promise<void> {
    this.correlator.reset();

    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play().catch(() => undefined);

    this.flash = new FlashDetector(this.video, (t) => {
      this.correlator.addFlash(t);
      this.emit();
    });
    this.audio = new AudioOnsetDetector(
      (t) => {
        this.correlator.addBeep(t);
        this.emit();
      },
      { targetFreq: this.opts.targetFreq },
    );

    this.flash.start();
    await this.audio.start(stream);
  }

  private emit(): void {
    this.onUpdate({ stats: this.correlator.stats(), samples: this.correlator.samples() });
  }

  stop(): void {
    this.flash?.stop();
    this.audio?.stop();
    this.flash = null;
    this.audio = null;
    if (this.video.srcObject) {
      this.video.pause();
      this.video.srcObject = null;
    }
  }

  reset(): void {
    this.correlator.reset();
    this.emit();
  }

  get currentStats(): MeasurementStats | null {
    return this.correlator.stats();
  }
}
