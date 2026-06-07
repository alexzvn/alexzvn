// WebCodecs-Capture-Pipeline: getDisplayMedia() → MediaStreamTrackProcessor →
// VideoFrame-Strom. Jeder (FPS-gekappte) Frame wird synchron an onFrame
// übergeben und unmittelbar danach geschlossen — frame.close() ist Pflicht,
// da VideoFrames ein hartes GPU-Ressourcenlimit haben und Lecks die Aufnahme
// abwürgen.
//
// In Phase 2 ist der Konsument die lokale Vorschau (Canvas). Der native
// NDI-Sender dockt später an genau dieser Stelle an: Frame → copyTo(BGRA) →
// transferable ArrayBuffer → MessagePort → utilityProcess.

export interface CaptureStats {
  width: number;
  height: number;
  fps: number;
}

export interface CaptureCallbacks {
  /** Synchron pro emittiertem Frame. NICHT schließen – die Session schließt
   *  den Frame direkt nach Rückkehr. */
  onFrame?: (frame: VideoFrame) => void;
  onStats?: (stats: CaptureStats) => void;
  onError?: (error: Error) => void;
  onEnded?: () => void;
}

export interface CaptureOptions {
  targetFps: number;
}

export class CaptureSession {
  private stream: MediaStream | null = null;
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private running = false;
  private emitted = 0;
  private lastStatsT = 0;
  private lastEmitT = 0;

  constructor(
    private readonly cb: CaptureCallbacks,
    private readonly opts: CaptureOptions,
  ) {}

  async start(): Promise<void> {
    // Audio kommt in Phase 3; hier zunächst video-only.
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('Kein Video-Track in der Aufnahme.');
    track.addEventListener('ended', () => this.stop());

    const processor = new MediaStreamTrackProcessor<VideoFrame>({ track });
    this.reader = processor.readable.getReader();
    this.running = true;
    this.lastStatsT = performance.now();
    void this.loop();
  }

  private async loop(): Promise<void> {
    const minInterval = 1000 / this.opts.targetFps;
    try {
      while (this.running && this.reader) {
        const { value: frame, done } = await this.reader.read();
        if (done) break;
        if (!frame) continue;
        try {
          const now = performance.now();
          // FPS-Cap per Timestamp-Gating; zu schnelle Frames werden verworfen
          // (aber immer geschlossen). NDI ist live → kein Aufstauen.
          if (now - this.lastEmitT >= minInterval - 1) {
            this.lastEmitT = now;
            this.emitted++;
            this.cb.onFrame?.(frame);
            if (now - this.lastStatsT >= 1000) {
              const fps = Math.round((this.emitted * 1000) / (now - this.lastStatsT));
              this.cb.onStats?.({ width: frame.displayWidth, height: frame.displayHeight, fps });
              this.emitted = 0;
              this.lastStatsT = now;
            }
          }
        } finally {
          frame.close();
        }
      }
    } catch (err) {
      this.cb.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.cb.onEnded?.();
    }
  }

  stop(): void {
    if (!this.running && !this.stream) return;
    this.running = false;
    this.reader?.cancel().catch(() => {});
    this.reader = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
