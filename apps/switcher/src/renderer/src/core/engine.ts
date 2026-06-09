// Framework-unabhängige Switcher-Engine: verwaltet Quellen, zeichnet Preview +
// Program auf zwei Canvases (requestAnimationFrame) und führt Cut/Auto-Dissolve
// aus. Quellen v0.1: Farbe/Test + Bildschirm (<video> aus getDisplayMedia).
// NDI/Capture-Karte kommen in späteren Slices als weitere Quelltypen dazu.

export type SourceKind = 'color' | 'screen';

export interface SourceInfo {
  id: string;
  name: string;
  kind: SourceKind;
  color?: string;
}

export interface EngineState {
  sources: SourceInfo[];
  previewId: string | null;
  programId: string | null;
  transitioning: boolean;
  autoMs: number;
}

interface InternalSource {
  info: SourceInfo;
  video: HTMLVideoElement | null;
  stream: MediaStream | null;
}

const RENDER_W = 1280;
const RENDER_H = 720;

export class SwitcherEngine {
  private sources: InternalSource[] = [];
  private previewId: string | null = null;
  private programId: string | null = null;
  private autoMs = 800;
  private transition: { fromId: string | null; toId: string; t0: number; dur: number } | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;
  private programCanvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private listeners = new Set<() => void>();
  private seq = 0;

  attach(preview: HTMLCanvasElement, program: HTMLCanvasElement): void {
    this.previewCanvas = preview;
    this.programCanvas = program;
    preview.width = RENDER_W;
    preview.height = RENDER_H;
    program.width = RENDER_W;
    program.height = RENDER_H;
    if (!this.raf) this.loop();
  }

  detach(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.detach();
    for (const s of this.sources) this.disposeSource(s);
    this.sources = [];
    this.previewId = null;
    this.programId = null;
    this.transition = null;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): EngineState {
    return {
      sources: this.sources.map((s) => ({ ...s.info })),
      previewId: this.previewId,
      programId: this.programId,
      transitioning: this.transition != null,
      autoMs: this.autoMs,
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private nextId(): string {
    this.seq += 1;
    return `src-${this.seq}`;
  }

  addColor(name: string, color: string): string {
    const id = this.nextId();
    this.sources.push({ info: { id, name, kind: 'color', color }, video: null, stream: null });
    if (!this.previewId) this.previewId = id;
    if (!this.programId) this.programId = id;
    this.notify();
    return id;
  }

  addScreenStream(name: string, stream: MediaStream): string {
    const id = this.nextId();
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    void video.play().catch(() => {});
    this.sources.push({ info: { id, name, kind: 'screen' }, video, stream });
    if (!this.previewId) this.previewId = id;
    this.notify();
    return id;
  }

  removeSource(id: string): void {
    const idx = this.sources.findIndex((s) => s.info.id === id);
    if (idx < 0) return;
    this.disposeSource(this.sources[idx]);
    this.sources.splice(idx, 1);
    if (this.previewId === id) this.previewId = this.sources[0]?.info.id ?? null;
    if (this.programId === id) this.programId = null;
    if (this.transition && (this.transition.fromId === id || this.transition.toId === id)) {
      this.transition = null;
    }
    this.notify();
  }

  private disposeSource(s: InternalSource): void {
    s.stream?.getTracks().forEach((t) => t.stop());
    if (s.video) s.video.srcObject = null;
  }

  setPreview(id: string): void {
    this.previewId = id;
    this.notify();
  }

  setAutoMs(ms: number): void {
    this.autoMs = Math.max(0, Math.floor(ms) || 0);
    this.notify();
  }

  /** Harter Schnitt: Program = Preview. */
  cut(): void {
    if (!this.previewId) return;
    this.programId = this.previewId;
    this.transition = null;
    this.notify();
  }

  /** Weiche Blende Program → Preview über autoMs. */
  auto(ms?: number): void {
    if (!this.previewId || this.previewId === this.programId || this.transition) return;
    this.transition = {
      fromId: this.programId,
      toId: this.previewId,
      t0: performance.now(),
      dur: ms ?? this.autoMs,
    };
    this.notify();
  }

  private loop = (): void => {
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(): void {
    this.paint(this.previewCanvas, this.previewId, 1, true);

    if (this.transition) {
      const k =
        this.transition.dur > 0
          ? Math.min(1, (performance.now() - this.transition.t0) / this.transition.dur)
          : 1;
      this.paint(this.programCanvas, this.transition.fromId, 1, true);
      this.paint(this.programCanvas, this.transition.toId, k, false);
      if (k >= 1) {
        this.programId = this.transition.toId;
        this.transition = null;
        this.notify();
      }
    } else {
      this.paint(this.programCanvas, this.programId, 1, true);
    }
  }

  private paint(
    canvas: HTMLCanvasElement | null,
    id: string | null,
    alpha: number,
    clearFirst: boolean,
  ): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    if (clearFirst) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }
    if (!id) return;
    const s = this.sources.find((x) => x.info.id === id);
    if (!s) return;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (s.info.kind === 'color' && s.info.color) {
      ctx.fillStyle = s.info.color;
      ctx.fillRect(0, 0, w, h);
    } else if (s.video && s.video.readyState >= 2 && s.video.videoWidth > 0) {
      drawContain(ctx, s.video, s.video.videoWidth, s.video.videoHeight, w, h);
    }
    ctx.globalAlpha = 1;
  }
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  cw: number,
  ch: number,
): void {
  const scale = Math.min(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}
