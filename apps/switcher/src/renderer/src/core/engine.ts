// Framework-unabhängige Switcher-Engine (OBS-Modell):
//   Quellen-Pool (color/screen) → Szenen (geordnete Ebenen mit Position/Größe)
//   → Program/Preview schalten *Szenen* (Cut hart, Auto = Dissolve).
// Gezeichnet auf zwei Canvases per requestAnimationFrame. NDI/Capture-Karte
// kommen als weitere Quelltypen in späteren Slices dazu.

export type SourceKind = 'color' | 'screen' | 'ndi';

export interface SourceInfo {
  id: string;
  name: string;
  kind: SourceKind;
  color?: string;
}

/** Eine Ebene in einer Szene — Quelle + normalisiertes Rechteck (0..1). */
export interface LayerInfo {
  id: string;
  sourceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export interface SceneInfo {
  id: string;
  name: string;
  /** Reihenfolge: erste Ebene = hinten, letzte = vorne. */
  layers: LayerInfo[];
}

export interface EngineState {
  sources: SourceInfo[];
  scenes: SceneInfo[];
  previewSceneId: string | null;
  programSceneId: string | null;
  transitioning: boolean;
  autoMs: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface InternalSource {
  info: SourceInfo;
  video: HTMLVideoElement | null;
  stream: MediaStream | null;
  // NDI: empfangene BGRA-Frames werden in dieses Offscreen-Canvas geschrieben
  // und von dort wie ein <video> in die Ebene gezeichnet.
  ndiCanvas?: HTMLCanvasElement;
  ndiCtx?: CanvasRenderingContext2D | null;
  ndiImage?: ImageData;
  ndiReady?: boolean;
}

const RENDER_W = 1280;
const RENDER_H = 720;

export class SwitcherEngine {
  private sources: InternalSource[] = [];
  private scenes: SceneInfo[] = [];
  private previewSceneId: string | null = null;
  private programSceneId: string | null = null;
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
    this.scenes = [];
    this.previewSceneId = null;
    this.programSceneId = null;
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
      scenes: this.scenes.map((sc) => ({ ...sc, layers: sc.layers.map((l) => ({ ...l })) })),
      previewSceneId: this.previewSceneId,
      programSceneId: this.programSceneId,
      transitioning: this.transition != null,
      autoMs: this.autoMs,
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  // ---- Quellen-Pool ----

  addColor(name: string, color: string): string {
    const id = this.nextId('src');
    this.sources.push({ info: { id, name, kind: 'color', color }, video: null, stream: null });
    this.notify();
    return id;
  }

  addScreenStream(name: string, stream: MediaStream): string {
    const id = this.nextId('src');
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    void video.play().catch(() => {});
    this.sources.push({ info: { id, name, kind: 'screen' }, video, stream });
    this.notify();
    return id;
  }

  /** Eine NDI-Quelle in den Pool legen (Frames kommen via updateNdiFrame). */
  addNdiSource(name: string): string {
    const id = this.nextId('src');
    this.sources.push({ info: { id, name, kind: 'ndi' }, video: null, stream: null });
    this.notify();
    return id;
  }

  /**
   * Ein empfangenes BGRA-Frame in das Offscreen-Canvas der NDI-Quelle schreiben.
   * Bewusst OHNE notify() — der rAF-Loop liest das Canvas direkt; React muss
   * nicht 30×/s neu rendern.
   */
  updateNdiFrame(id: string, data: Uint8Array, width: number, height: number, lineStride: number): void {
    const src = this.sources.find((s) => s.info.id === id);
    if (!src || src.info.kind !== 'ndi' || width <= 0 || height <= 0) return;
    if (!src.ndiCanvas) src.ndiCanvas = document.createElement('canvas');
    if (src.ndiCanvas.width !== width || src.ndiCanvas.height !== height) {
      src.ndiCanvas.width = width;
      src.ndiCanvas.height = height;
      src.ndiCtx = src.ndiCanvas.getContext('2d');
      src.ndiImage = src.ndiCtx?.createImageData(width, height) ?? undefined;
    }
    const ctx = src.ndiCtx;
    const img = src.ndiImage;
    if (!ctx || !img) return;
    bgraToRgba(data, img.data, width, height, lineStride);
    ctx.putImageData(img, 0, 0);
    src.ndiReady = true;
  }

  renameSource(id: string, name: string): void {
    const src = this.sources.find((s) => s.info.id === id);
    if (src) {
      src.info.name = name;
      this.notify();
    }
  }

  removeSource(id: string): void {
    const idx = this.sources.findIndex((s) => s.info.id === id);
    if (idx < 0) return;
    this.disposeSource(this.sources[idx]);
    this.sources.splice(idx, 1);
    // Aus allen Szenen die Ebenen dieser Quelle entfernen.
    for (const sc of this.scenes) sc.layers = sc.layers.filter((l) => l.sourceId !== id);
    this.notify();
  }

  private disposeSource(s: InternalSource): void {
    s.stream?.getTracks().forEach((t) => t.stop());
    if (s.video) s.video.srcObject = null;
  }

  // ---- Szenen ----

  addScene(name: string): string {
    const id = this.nextId('scene');
    this.scenes.push({ id, name, layers: [] });
    if (!this.previewSceneId) this.previewSceneId = id;
    if (!this.programSceneId) this.programSceneId = id;
    this.notify();
    return id;
  }

  removeScene(id: string): void {
    const idx = this.scenes.findIndex((s) => s.id === id);
    if (idx < 0) return;
    this.scenes.splice(idx, 1);
    if (this.previewSceneId === id) this.previewSceneId = this.scenes[0]?.id ?? null;
    if (this.programSceneId === id) this.programSceneId = this.scenes[0]?.id ?? null;
    if (this.transition && (this.transition.fromId === id || this.transition.toId === id)) {
      this.transition = null;
    }
    this.notify();
  }

  renameScene(id: string, name: string): void {
    const sc = this.scenes.find((s) => s.id === id);
    if (sc) {
      sc.name = name;
      this.notify();
    }
  }

  setPreviewScene(id: string): void {
    this.previewSceneId = id;
    this.notify();
  }

  // ---- Ebenen ----

  /** Quelle als Ebene in eine Szene legen. Erste Ebene = Vollbild, weitere = PiP. */
  addLayer(sceneId: string, sourceId: string): void {
    const sc = this.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    const first = sc.layers.length === 0;
    const rect: Rect = first ? { x: 0, y: 0, w: 1, h: 1 } : { x: 0.66, y: 0.06, w: 0.3, h: 0.3 };
    sc.layers.push({ id: this.nextId('layer'), sourceId, ...rect, visible: true });
    this.notify();
  }

  removeLayer(sceneId: string, layerId: string): void {
    const sc = this.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    sc.layers = sc.layers.filter((l) => l.id !== layerId);
    this.notify();
  }

  setLayerRect(sceneId: string, layerId: string, rect: Rect): void {
    const layer = this.scenes.find((s) => s.id === sceneId)?.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.x = rect.x;
    layer.y = rect.y;
    layer.w = rect.w;
    layer.h = rect.h;
    this.notify();
  }

  setLayerVisible(sceneId: string, layerId: string, visible: boolean): void {
    const layer = this.scenes.find((s) => s.id === sceneId)?.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.visible = visible;
    this.notify();
  }

  /** Ebene in der Z-Reihenfolge verschieben (+1 = weiter nach vorn). */
  moveLayer(sceneId: string, layerId: string, dir: -1 | 1): void {
    const sc = this.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    const i = sc.layers.findIndex((l) => l.id === layerId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sc.layers.length) return;
    [sc.layers[i], sc.layers[j]] = [sc.layers[j], sc.layers[i]];
    this.notify();
  }

  // ---- Transport ----

  setAutoMs(ms: number): void {
    this.autoMs = Math.max(0, Math.floor(ms) || 0);
    this.notify();
  }

  cut(): void {
    if (!this.previewSceneId) return;
    this.programSceneId = this.previewSceneId;
    this.transition = null;
    this.notify();
  }

  auto(ms?: number): void {
    if (!this.previewSceneId || this.previewSceneId === this.programSceneId || this.transition) return;
    this.transition = {
      fromId: this.programSceneId,
      toId: this.previewSceneId,
      t0: performance.now(),
      dur: ms ?? this.autoMs,
    };
    this.notify();
  }

  // ---- Rendering ----

  private loop = (): void => {
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(): void {
    this.paintScene(this.previewCanvas, this.previewSceneId, 1, true);

    if (this.transition) {
      const k =
        this.transition.dur > 0
          ? Math.min(1, (performance.now() - this.transition.t0) / this.transition.dur)
          : 1;
      this.paintScene(this.programCanvas, this.transition.fromId, 1, true);
      this.paintScene(this.programCanvas, this.transition.toId, k, false);
      if (k >= 1) {
        this.programSceneId = this.transition.toId;
        this.transition = null;
        this.notify();
      }
    } else {
      this.paintScene(this.programCanvas, this.programSceneId, 1, true);
    }
  }

  private paintScene(
    canvas: HTMLCanvasElement | null,
    sceneId: string | null,
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
    const scene = sceneId ? this.scenes.find((s) => s.id === sceneId) : null;
    if (!scene) return;
    for (const layer of scene.layers) {
      if (!layer.visible) continue;
      const src = this.sources.find((x) => x.info.id === layer.sourceId);
      if (!src) continue;
      const dx = layer.x * w;
      const dy = layer.y * h;
      const dw = layer.w * w;
      const dh = layer.h * h;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      if (src.info.kind === 'color' && src.info.color) {
        ctx.fillStyle = src.info.color;
        ctx.fillRect(dx, dy, dw, dh);
      } else if (src.info.kind === 'ndi') {
        if (src.ndiReady && src.ndiCanvas) {
          drawContainInto(ctx, src.ndiCanvas, src.ndiCanvas.width, src.ndiCanvas.height, dx, dy, dw, dh);
        }
      } else if (src.video && src.video.readyState >= 2 && src.video.videoWidth > 0) {
        drawContainInto(ctx, src.video, src.video.videoWidth, src.video.videoHeight, dx, dy, dw, dh);
      }
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * BGRA → RGBA (Canvas-ImageData erwartet RGBA). Schneller Pfad per Uint32 (eine
 * Operation/Pixel) wenn dicht gepackt; sonst Byte-Schleife mit Stride-Beachtung.
 * Little-Endian-Layout der Quelle: Bits 0-7 = B, 8-15 = G, 16-23 = R, 24-31 = A.
 */
function bgraToRgba(
  src: Uint8Array,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  stride: number,
): void {
  if (stride === w * 4 && src.byteOffset % 4 === 0 && src.byteLength >= w * h * 4) {
    const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
    const d32 = new Uint32Array(dst.buffer, dst.byteOffset, w * h);
    for (let i = 0; i < s32.length; i++) {
      const p = s32[i];
      // A + G bleiben; B (Bits 0-7) → 16-23, R (Bits 16-23) → 0-7.
      d32[i] = (p & 0xff00ff00) | ((p & 0xff) << 16) | ((p >>> 16) & 0xff);
    }
    return;
  }
  for (let y = 0; y < h; y++) {
    let s = y * stride;
    let d = y * w * 4;
    for (let x = 0; x < w; x++) {
      dst[d] = src[s + 2]; // R
      dst[d + 1] = src[s + 1]; // G
      dst[d + 2] = src[s]; // B
      dst[d + 3] = src[s + 3]; // A
      s += 4;
      d += 4;
    }
  }
}

function drawContainInto(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const scale = Math.min(dw / iw, dh / ih);
  const cw = iw * scale;
  const ch = ih * scale;
  ctx.drawImage(img, dx + (dw - cw) / 2, dy + (dh - ch) / 2, cw, ch);
}
