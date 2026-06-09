// Programm-Audio: nimmt EIN Eingangsgerät (Mikro/Line-In/Capture-Ton) über
// getUserMedia, führt es durch einen WebAudio-Graph (Gain für Fader/Mute +
// Analyser für den Pegel) und liefert einen Ausgangs-Track, der zusammen mit dem
// Program-Canvas in den MediaRecorder (Aufnahme + RTMP) geht.
//
//   getUserMedia → MediaStreamSource → Gain → (Analyser, MediaStreamDestination)
//
// Fader/Mute wirken live (Gain-Node). Ein Gerätewechsel baut den Graph neu — das
// wirkt im Output erst beim nächsten Start (MediaRecorder-Track ist fix).

export interface AudioState {
  hasDevice: boolean;
  muted: boolean;
  gain: number; // 0..1.5
  level: number; // 0..1 (RMS)
  error: string | null;
}

export class AudioController {
  private ctx: AudioContext | null = null;
  private srcStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private buf = new Float32Array(2048);
  private meterTimer: number | null = null;
  private currentDeviceId = '';

  private state: AudioState = { hasDevice: false, muted: false, gain: 1, level: 0, error: null };
  private listeners = new Set<() => void>();

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): AudioState {
    return { ...this.state };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private patch(p: Partial<AudioState>): void {
    this.state = { ...this.state, ...p };
    this.notify();
  }

  /** Aktiver Audio-Ausgangs-Track (für die Recorder-Stream-Kombi) oder null. */
  getOutputTrack(): MediaStreamTrack | null {
    return this.dest?.stream.getAudioTracks()[0] ?? null;
  }

  hasAudio(): boolean {
    return this.getOutputTrack() != null;
  }

  /** Eingangsgerät setzen ('' = aus). Baut den Graph (neu) auf. */
  async setDevice(deviceId: string): Promise<void> {
    if (deviceId === this.currentDeviceId && (deviceId === '' || this.dest)) return;
    this.currentDeviceId = deviceId;
    this.teardownGraph();
    if (!deviceId) {
      this.patch({ hasDevice: false, level: 0, error: null });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      // Falls zwischenzeitlich ein anderes Gerät gewählt wurde: verwerfen.
      if (this.currentDeviceId !== deviceId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = this.ctx ?? new AudioContext();
      this.ctx = ctx;
      void ctx.resume().catch(() => {});
      this.srcStream = stream;
      this.source = ctx.createMediaStreamSource(stream);
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = this.state.muted ? 0 : this.state.gain;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.buf = new Float32Array(this.analyser.fftSize);
      this.dest = ctx.createMediaStreamDestination();
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.gainNode.connect(this.dest);
      this.startMeter();
      this.patch({ hasDevice: true, error: null });
    } catch (e) {
      this.currentDeviceId = '';
      this.patch({ hasDevice: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  setMuted(muted: boolean): void {
    if (this.gainNode) this.gainNode.gain.value = muted ? 0 : this.state.gain;
    this.patch({ muted });
  }

  setGain(gain: number): void {
    const g = Math.min(1.5, Math.max(0, gain));
    if (this.gainNode && !this.state.muted) this.gainNode.gain.value = g;
    this.patch({ gain: g });
  }

  private startMeter(): void {
    if (this.meterTimer != null) return;
    const tick = (): void => {
      const an = this.analyser;
      if (!an) {
        this.meterTimer = null;
        return;
      }
      an.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      const rms = Math.sqrt(sum / this.buf.length);
      // Leicht geglättet, damit der Balken nicht flackert.
      const level = Math.max(rms, this.state.level * 0.8);
      if (Math.abs(level - this.state.level) > 0.002) this.patch({ level });
      this.meterTimer = window.setTimeout(tick, 60);
    };
    tick();
  }

  private teardownGraph(): void {
    if (this.meterTimer != null) {
      clearTimeout(this.meterTimer);
      this.meterTimer = null;
    }
    try {
      this.source?.disconnect();
      this.gainNode?.disconnect();
      this.analyser?.disconnect();
    } catch {
      // egal
    }
    this.srcStream?.getTracks().forEach((t) => t.stop());
    this.srcStream = null;
    this.source = null;
    this.gainNode = null;
    this.analyser = null;
    this.dest = null;
  }

  destroy(): void {
    this.teardownGraph();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.listeners.clear();
  }
}
