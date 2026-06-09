// WebCodecs-Capture-Pipeline: getDisplayMedia() → MediaStreamTrackProcessor →
// VideoFrame-/AudioData-Strom. Frames werden an onFrame/onAudio übergeben und
// unmittelbar danach geschlossen — close() ist Pflicht (VideoFrame/AudioData
// sind ein hartes Ressourcenlimit). onFrame/onAudio dürfen async sein (z. B.
// copyTo + MessagePort-Transfer); die Session wartet, bevor sie schließt.
//
// onFrame kopiert den Frame als BGRA in einen ArrayBuffer und überträgt ihn
// transferable an den utilityProcess (nativer NDI-Sender). Daneben dient er der
// lokalen Canvas-Vorschau.

export interface CaptureStats {
  width: number;
  height: number;
  fps: number;
}

export interface CaptureCallbacks {
  /** Pro (FPS-gekapptem) Video-Frame. Darf async sein; danach wird geschlossen. */
  onFrame?: (frame: VideoFrame) => void | Promise<void>;
  /** Pro Audio-Paket (nur wenn ein Audio-Track vorhanden ist). */
  onAudio?: (data: AudioData) => void | Promise<void>;
  onStats?: (stats: CaptureStats) => void;
  onError?: (error: Error) => void;
  onEnded?: () => void;
}

export interface CaptureOptions {
  targetFps: number;
  audio: boolean;
}

export class CaptureSession {
  private stream: MediaStream | null = null;
  private videoReader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private audioReader: ReadableStreamDefaultReader<AudioData> | null = null;
  private running = false;
  private emitted = 0;
  private lastStatsT = 0;
  private lastEmitT = 0;

  constructor(
    private readonly cb: CaptureCallbacks,
    private readonly opts: CaptureOptions,
  ) {}

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: this.opts.audio,
    });
    this.stream = stream;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('Kein Video-Track in der Aufnahme.');
    videoTrack.addEventListener('ended', () => this.stop());

    this.running = true;
    this.lastStatsT = performance.now();

    const videoProc = new MediaStreamTrackProcessor<VideoFrame>({ track: videoTrack });
    this.videoReader = videoProc.readable.getReader();
    void this.videoLoop();

    // Audio ist optional — auf Nicht-Windows (kein Loopback) gibt es keinen Track.
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      const audioProc = new MediaStreamTrackProcessor<AudioData>({ track: audioTrack });
      this.audioReader = audioProc.readable.getReader();
      void this.audioLoop();
    }
  }

  private async videoLoop(): Promise<void> {
    const minInterval = 1000 / this.opts.targetFps;
    try {
      while (this.running && this.videoReader) {
        const { value: frame, done } = await this.videoReader.read();
        if (done) break;
        if (!frame) continue;
        try {
          const now = performance.now();
          // FPS-Cap per Timestamp-Gating; zu schnelle Frames werden verworfen
          // (aber immer geschlossen). NDI ist live → kein Aufstauen.
          if (now - this.lastEmitT >= minInterval - 1) {
            this.lastEmitT = now;
            this.emitted++;
            await this.cb.onFrame?.(frame);
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

  private async audioLoop(): Promise<void> {
    try {
      while (this.running && this.audioReader) {
        const { value: data, done } = await this.audioReader.read();
        if (done) break;
        if (!data) continue;
        try {
          await this.cb.onAudio?.(data);
        } finally {
          data.close();
        }
      }
    } catch {
      // Audio ist optional — Fehler hier sollen die Video-Aufnahme nicht stoppen.
    }
  }

  stop(): void {
    if (!this.running && !this.stream) return;
    this.running = false;
    this.videoReader?.cancel().catch(() => {});
    this.videoReader = null;
    this.audioReader?.cancel().catch(() => {});
    this.audioReader = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
