// Renderer-Seite des Program-Outputs: kodiert den Program-Canvas per
// MediaRecorder zu WebM und streamt die Chunks an den Main (Datei + ffmpeg/RTMP).
// Pro Output ein eigener MediaRecorder → jeder Sink bekommt einen eigenen
// WebM-Header (sauberer Stream-Start, kein Late-Join-Problem).

export interface OutputState {
  recording: boolean;
  streaming: boolean;
  recPath: string | null;
  error: string | null;
}

const REC_BITS = 8_000_000;
const TIMESLICE_MS = 500;

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

export class OutputController {
  private getCanvas: () => HTMLCanvasElement | null;
  private stream: MediaStream | null = null;
  private recRecorder: MediaRecorder | null = null;
  private streamRecorder: MediaRecorder | null = null;
  private state: OutputState = { recording: false, streaming: false, recPath: null, error: null };
  private listeners = new Set<() => void>();
  private offError: (() => void) | null = null;
  private offStatus: (() => void) | null = null;

  constructor(getCanvas: () => HTMLCanvasElement | null) {
    this.getCanvas = getCanvas;
    this.offError = window.jmswitch.output.onError((err) => {
      this.teardown(err.scope === 'record' ? 'rec' : 'stream');
      this.patch({ error: err.message });
    });
    this.offStatus = window.jmswitch.output.onStatus((s) => {
      // Main meldet z. B. ffmpeg-Exit → Stream-Recorder mitziehen.
      if (!s.streaming && this.streamRecorder) this.teardown('stream');
    });
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): OutputState {
    return { ...this.state };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private patch(p: Partial<OutputState>): void {
    this.state = { ...this.state, ...p };
    this.notify();
  }

  private ensureStream(): MediaStream | null {
    if (this.stream) return this.stream;
    const c = this.getCanvas();
    if (!c) return null;
    this.stream = c.captureStream(30);
    return this.stream;
  }

  /** Aufnahme mit Speicherdialog (UI-Button). */
  startRecording(): Promise<void> {
    return this.beginRecording(() => window.jmswitch.output.recStart());
  }

  /** Aufnahme ohne Dialog (Fernsteuerung): Standardordner + Zeitstempel. */
  startRecordingAuto(): Promise<void> {
    return this.beginRecording(() => window.jmswitch.output.recStartAuto());
  }

  private async beginRecording(
    open: () => Promise<{ ok: boolean; path?: string; error?: string }>,
  ): Promise<void> {
    if (this.recRecorder) return;
    const stream = this.ensureStream();
    if (!stream) {
      this.patch({ error: 'Kein Program-Bild zum Aufnehmen.' });
      return;
    }
    const res = await open();
    if (!res.ok) {
      if (res.error) this.patch({ error: res.error });
      return; // abgebrochen
    }
    const rec = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: REC_BITS });
    rec.ondataavailable = (e) => void this.send(e.data, 'rec');
    rec.onstop = () => window.jmswitch.output.recStop();
    rec.onerror = () => {
      this.teardown('rec');
      this.patch({ error: 'Aufnahme-Encoder-Fehler.' });
    };
    rec.start(TIMESLICE_MS);
    this.recRecorder = rec;
    this.patch({ recording: true, recPath: res.path ?? null, error: null });
  }

  stopRecording(): void {
    this.teardown('rec');
  }

  async startStreaming(url: string, bitrateKbps?: number): Promise<void> {
    if (this.streamRecorder) return;
    const stream = this.ensureStream();
    if (!stream) {
      this.patch({ error: 'Kein Program-Bild zum Streamen.' });
      return;
    }
    const res = await window.jmswitch.output.streamStart(url, bitrateKbps);
    if (!res.ok) {
      this.patch({ error: res.error ?? 'Stream-Start fehlgeschlagen.' });
      return;
    }
    const rec = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: REC_BITS });
    rec.ondataavailable = (e) => void this.send(e.data, 'stream');
    rec.onstop = () => window.jmswitch.output.streamStop();
    rec.onerror = () => {
      this.teardown('stream');
      this.patch({ error: 'Stream-Encoder-Fehler.' });
    };
    rec.start(TIMESLICE_MS);
    this.streamRecorder = rec;
    this.patch({ streaming: true, error: null });
  }

  stopStreaming(): void {
    this.teardown('stream');
  }

  private async send(blob: Blob, scope: 'rec' | 'stream'): Promise<void> {
    if (!blob || blob.size === 0) return;
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (scope === 'rec') window.jmswitch.output.recChunk(buf);
    else window.jmswitch.output.streamChunk(buf);
  }

  private teardown(scope: 'rec' | 'stream'): void {
    const rec = scope === 'rec' ? this.recRecorder : this.streamRecorder;
    if (rec) {
      try {
        if (rec.state !== 'inactive') rec.stop(); // onstop → recStop/streamStop an den Main
      } catch {
        // egal
      }
    }
    if (scope === 'rec') {
      this.recRecorder = null;
      this.patch({ recording: false });
    } else {
      this.streamRecorder = null;
      this.patch({ streaming: false });
    }
  }

  destroy(): void {
    this.teardown('rec');
    this.teardown('stream');
    this.offError?.();
    this.offStatus?.();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.listeners.clear();
  }
}
