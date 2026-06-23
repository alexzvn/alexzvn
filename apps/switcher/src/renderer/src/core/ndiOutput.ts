// Renderer-Seite der NDI-Ausgabe: liest pro Tick das gewählte Quell-Canvas
// (Program- oder Multiview-Bild), wandelt RGBA→BGRA und postet es auf den vom
// Main übergebenen Frame-Port (→ utilityProcess → sendVideoBGRA). Gedrosselt auf
// eine Ziel-Framerate, damit der Encoder/Netz nicht überlastet wird.
//
// Gleiche Pixel-Mechanik wie der JM Titler: ohne Transfer posten (Buffer wird
// kopiert; ein transferierter ArrayBuffer käme über die Port-Grenze als null an).

const OUT_W = 1280;
const OUT_H = 720;
const TARGET_FPS = 25;

export interface NdiOutputState {
  active: boolean;
  name: string;
  connections: number;
  error: string | null;
}

export class NdiOutputController {
  private getSource: () => HTMLCanvasElement | null;
  private out: HTMLCanvasElement;
  private outCtx: CanvasRenderingContext2D | null;
  private port: MessagePort | null = null;
  private raf = 0;
  private lastSend = 0;
  private state: NdiOutputState = { active: false, name: '', connections: 0, error: null };
  private listeners = new Set<() => void>();
  private offStatus: (() => void) | null = null;
  private onPortMsg: (e: MessageEvent) => void;

  constructor(getSource: () => HTMLCanvasElement | null) {
    this.getSource = getSource;
    this.out = document.createElement('canvas');
    this.out.width = OUT_W;
    this.out.height = OUT_H;
    this.outCtx = this.out.getContext('2d', { willReadFrequently: true });

    // Frame-Port der NDI-Ausgabe vom Main empfangen (Preload → window 'message').
    this.onPortMsg = (e: MessageEvent): void => {
      const data = e.data as { kind?: string } | null;
      if (!data || data.kind !== 'jmswitch:ndi-out-port' || !e.ports[0]) return;
      try {
        this.port?.close();
      } catch {
        // egal
      }
      this.port = e.ports[0];
      this.port.start();
    };
    window.addEventListener('message', this.onPortMsg);

    this.offStatus = window.jmswitch.output.onNdiStatus((s) => {
      this.patch({ active: s.active, name: s.name, connections: s.connections });
    });
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): NdiOutputState {
    return { ...this.state };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private patch(p: Partial<NdiOutputState>): void {
    this.state = { ...this.state, ...p };
    this.notify();
  }

  async start(name: string): Promise<void> {
    const res = await window.jmswitch.output.ndiStart(name);
    if (!res.ok) {
      this.patch({ error: res.error ?? 'NDI-Ausgabe konnte nicht starten.' });
      return;
    }
    this.patch({ active: true, name, error: null });
    if (!this.raf) this.loop();
  }

  async stop(): Promise<void> {
    await window.jmswitch.output.ndiStop();
    this.patch({ active: false, connections: 0 });
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private loop = (): void => {
    this.pump();
    this.raf = requestAnimationFrame(this.loop);
  };

  private pump(): void {
    if (!this.state.active || !this.port || !this.outCtx) return;
    const now = performance.now();
    if (now - this.lastSend < 1000 / TARGET_FPS) return;
    this.lastSend = now;
    const src = this.getSource();
    if (!src || src.width === 0) return;

    // Quelle (Program/Multiview) auf Ausgabegröße bringen, dann auslesen.
    this.outCtx.drawImage(src, 0, 0, OUT_W, OUT_H);
    const img = this.outCtx.getImageData(0, 0, OUT_W, OUT_H);
    const u32 = new Uint32Array(img.data.buffer);
    // RGBA (0xAABBGGRR LE) → BGRA (0xAARRGGBB LE): R und B tauschen.
    for (let i = 0; i < u32.length; i++) {
      const p = u32[i];
      u32[i] = (p & 0xff00ff00) | ((p & 0x000000ff) << 16) | ((p & 0x00ff0000) >>> 16);
    }
    this.port.postMessage({ type: 'video', buffer: img.data.buffer, w: OUT_W, h: OUT_H, fpsN: TARGET_FPS });
  }

  destroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('message', this.onPortMsg);
    this.offStatus?.();
    try {
      this.port?.close();
    } catch {
      // egal
    }
    this.port = null;
    void window.jmswitch.output.ndiStop().catch(() => {});
    this.listeners.clear();
  }
}
