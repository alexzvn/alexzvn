import type { BlendMode, BrushSettings, Point, RGBA, ShapeStyle, TextStyle, ToolId } from '../types';
import type { ImageFormat } from '@shared/types';
import type { ToolOptions, ToolContext, PointerInfo } from '../tools/Tool';
import type { Layer, RasterLayer } from '../doc/Layer';
import { Document } from '../doc/Document';
import { createRasterLayer, newLayerId } from '../doc/Layer';
import { Viewport } from '../viewport/Viewport';
import { Canvas2DCompositor } from '../compositor/Canvas2DCompositor';
import { History } from '../history/History';
import { makeCommand } from '../history/commands';
import { ToolManager } from '../tools/ToolManager';
import { OverlayRenderer } from './OverlayRenderer';
import { layerThumbnail } from './thumbnail';
import { selectionFromRect } from '../selection/SelectionOps';
import { safeAreaGuides } from '../io/safeArea';
import { encodeCanvas } from '../io/exportRaster';
import { createCanvas } from '../canvas';
import { BLACK, WHITE, rgbToHex } from '../color';

export interface LayerSummary {
  id: string;
  name: string;
  kind: Layer['kind'];
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked: boolean;
  isActive: boolean;
  hasMask: boolean;
  thumbnail: string;
}

export interface ControllerState {
  layers: LayerSummary[]; // top layer first (panel order)
  activeLayerId: string | null;
  toolId: ToolId;
  foreground: string; // hex
  background: string; // hex
  brush: BrushSettings;
  options: ToolOptions;
  zoom: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  docWidth: number;
  docHeight: number;
  showSafeArea: boolean;
}

const DEFAULT_OPTIONS: ToolOptions = {
  shapeKind: 'rectangle',
  shapeFill: true,
  shapeStroke: false,
  shapeStrokeWidth: 4,
  tolerance: 32,
  contiguous: true,
  textDefaults: {
    text: 'Text',
    fontFamily: '"Manrope Variable", system-ui, sans-serif',
    fontSize: 72,
    fontWeight: 800,
    color: { ...BLACK },
    align: 'left',
    lineHeight: 1.2,
    background: null,
    padding: 16,
  },
};

/**
 * The engine controller: owns the document, viewport, tools, history and the
 * two stacked canvases (document + overlay). It runs the render loop, routes
 * pointer/wheel input to the active tool, and exposes a flat API the React
 * panels call. State changes are mirrored to React via `onChange`.
 */
export class EditorController {
  doc: Document;
  readonly viewport = new Viewport();
  private readonly compositor = new Canvas2DCompositor();
  readonly history = new History();
  private readonly tools = new ToolManager();
  private readonly overlay: OverlayRenderer;

  foreground: RGBA = { ...BLACK };
  background: RGBA = { ...WHITE };
  brush: BrushSettings = { size: 24, hardness: 0.85, opacity: 1 };
  options: ToolOptions = structuredClone(DEFAULT_OPTIONS);
  showSafeArea = false;

  private docCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private docCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;

  private docDirty = true;
  private flatCache: HTMLCanvasElement | null = null;
  private preview: ((o: OverlayRenderer) => void) | null = null;
  private dashOffset = 0;
  private rafId = 0;
  private activePointer: number | null = null;
  private ro: ResizeObserver;
  private listeners = new Set<() => void>();
  private textEdit: { el: HTMLTextAreaElement; layerId: string; before: string } | null = null;

  constructor(private container: HTMLElement) {
    this.doc = Document.blank(1920, 1080);

    this.docCanvas = document.createElement('canvas');
    this.overlayCanvas = document.createElement('canvas');
    for (const c of [this.docCanvas, this.overlayCanvas]) {
      c.style.position = 'absolute';
      c.style.inset = '0';
      c.style.width = '100%';
      c.style.height = '100%';
    }
    this.overlayCanvas.style.touchAction = 'none';
    container.style.position = 'relative';
    container.appendChild(this.docCanvas);
    container.appendChild(this.overlayCanvas);

    this.docCtx = this.docCanvas.getContext('2d')!;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
    this.overlay = new OverlayRenderer(this.overlayCtx, this.viewport);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.viewport.fit(this.doc.width, this.doc.height, this.cssW, this.cssH);

    this.attachEvents();
    this.history.changed.on(() => {
      this.invalidate();
      this.notify();
    });
    this.loop();
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.ro.disconnect();
    this.detachEvents();
    this.docCanvas.remove();
    this.overlayCanvas.remove();
    this.textEdit?.el.remove();
  }

  // ---- rendering ---------------------------------------------------------

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = window.devicePixelRatio || 1;
    for (const c of [this.docCanvas, this.overlayCanvas]) {
      c.width = Math.round(this.cssW * this.dpr);
      c.height = Math.round(this.cssH * this.dpr);
    }
    this.docDirty = true;
  }

  /** Mark the composited document stale (re-render + invalidate caches). */
  requestRender(): void {
    this.docDirty = true;
    this.flatCache = null;
  }

  private invalidate(): void {
    this.requestRender();
  }

  private loop = (): void => {
    if (this.docDirty) {
      this.compositor.render(this.doc, this.viewport, this.docCtx, this.dpr);
      this.docDirty = false;
    }
    this.dashOffset = (this.dashOffset + 0.5) % 8;
    this.renderOverlay();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderOverlay(): void {
    const o = this.overlay;
    o.begin(this.dashOffset, this.dpr);
    o.documentBorder(this.doc.width, this.doc.height);
    if (this.showSafeArea) o.safeAreas(safeAreaGuides(this.doc.width, this.doc.height));
    if (this.doc.selection) o.selection(this.doc.selection);
    this.preview?.(o);
    this.tools.drawOverlay(o, this.makeCtx());
    this.syncTextEditPosition();
  }

  // ---- tool context ------------------------------------------------------

  private flatten(): HTMLCanvasElement {
    if (!this.flatCache) this.flatCache = this.compositor.flatten(this.doc);
    return this.flatCache;
  }

  private makeCtx(): ToolContext {
    return {
      doc: this.doc,
      viewport: this.viewport,
      history: this.history,
      foreground: this.foreground,
      background: this.background,
      brush: this.brush,
      options: this.options,
      requestRender: () => this.requestRender(),
      layersChanged: () => {
        this.requestRender();
        this.notify();
      },
      setSelection: (sel) => {
        this.doc.selection = sel;
        this.requestRender();
        this.notify();
      },
      setForeground: (c) => this.setForeground(c),
      setPreview: (draw) => {
        this.preview = draw;
      },
      sampleComposite: (x, y) => this.sampleAt(x, y),
      compositeImageData: () => {
        const f = this.flatten();
        return f.getContext('2d')!.getImageData(0, 0, f.width, f.height);
      },
      ensureRasterLayer: () => this.ensureRasterLayer(),
      activateTool: (id) => this.setTool(id),
      beginTextEdit: (layerId) => this.beginTextEdit(layerId),
    };
  }

  /**
   * Guarantee a paintable raster layer. Returns the active one if it is an
   * unlocked raster; otherwise inserts a fresh raster layer above the active
   * layer (so painting works even when a text/shape layer is selected).
   */
  ensureRasterLayer(): RasterLayer {
    const current = this.doc.activeRaster;
    if (current && !current.locked) return current;
    const layer = createRasterLayer(this.doc.width, this.doc.height, `Malebene ${this.doc.layers.length + 1}`);
    const at = this.doc.activeLayerId ? this.doc.indexOf(this.doc.activeLayerId) + 1 : this.doc.layers.length;
    const prevActive = this.doc.activeLayerId;
    this.pushStructural(
      'Neue Malebene',
      () => {
        if (this.doc.indexOf(layer.id) < 0) this.doc.layers.splice(at, 0, layer);
        this.doc.activeLayerId = layer.id;
      },
      () => {
        this.doc.removeLayer(layer.id);
        this.doc.activeLayerId = prevActive;
      },
    );
    return layer;
  }

  private sampleAt(x: number, y: number): RGBA {
    if (x < 0 || y < 0 || x >= this.doc.width || y >= this.doc.height) return { r: 0, g: 0, b: 0, a: 0 };
    const d = this.flatten().getContext('2d')!.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  }

  // ---- input -------------------------------------------------------------

  private attachEvents(): void {
    const el = this.overlayCanvas;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private detachEvents(): void {
    const el = this.overlayCanvas;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private toPointer(ev: PointerEvent): PointerInfo {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const screen: Point = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    return {
      doc: this.viewport.screenToDoc(screen),
      screen,
      shift: ev.shiftKey,
      alt: ev.altKey,
      ctrl: ev.ctrlKey || ev.metaKey,
      button: ev.button,
      pressure: ev.pressure || 0.5,
    };
  }

  private onPointerDown = (ev: PointerEvent): void => {
    if (this.textEdit) this.commitTextEdit();
    try {
      this.overlayCanvas.setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic events have no active pointer to capture */
    }
    this.activePointer = ev.pointerId;
    // Middle mouse always pans.
    if (ev.button === 1) this.tools.setOverride('hand');
    this.tools.down(this.toPointer(ev), this.makeCtx());
    this.updateCursor();
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (this.activePointer !== null && ev.pointerId !== this.activePointer) return;
    this.tools.move(this.toPointer(ev), this.makeCtx());
  };

  private onPointerUp = (ev: PointerEvent): void => {
    this.tools.up(this.toPointer(ev), this.makeCtx());
    if (ev.button === 1) this.tools.setOverride(this.spaceDown ? 'hand' : null);
    this.activePointer = null;
    this.updateCursor();
  };

  private onPointerLeave = (ev: PointerEvent): void => {
    this.tools.leave(this.toPointer(ev), this.makeCtx());
  };

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    const rect = this.overlayCanvas.getBoundingClientRect();
    const anchor: Point = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    const factor = Math.exp(-ev.deltaY * 0.0015);
    this.viewport.zoomAt(anchor, factor);
    this.requestRender();
    this.notify();
  };

  private spaceDown = false;
  private onKeyDown = (ev: KeyboardEvent): void => {
    if (this.isTypingTarget(ev.target)) return;
    if (ev.code === 'Space' && !this.spaceDown) {
      this.spaceDown = true;
      this.tools.setOverride('hand');
      this.updateCursor();
      ev.preventDefault();
    }
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    if (ev.code === 'Space') {
      this.spaceDown = false;
      this.tools.setOverride(null);
      this.updateCursor();
    }
  };

  private isTypingTarget(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  private updateCursor(): void {
    this.overlayCanvas.style.cursor = this.tools.cursor(this.makeCtx());
  }

  // ---- public API for panels --------------------------------------------

  setTool(id: ToolId): void {
    this.tools.setActive(id);
    this.preview = null;
    this.updateCursor();
    this.notify();
  }

  getToolId(): ToolId {
    return this.tools.activeToolId;
  }

  setForeground(c: RGBA): void {
    this.foreground = { ...c };
    this.notify();
  }

  setBackground(c: RGBA): void {
    this.background = { ...c };
    this.notify();
  }

  swapColors(): void {
    const fg = this.foreground;
    this.foreground = this.background;
    this.background = fg;
    this.notify();
  }

  setBrush(patch: Partial<BrushSettings>): void {
    this.brush = { ...this.brush, ...patch };
    this.notify();
  }

  setOptions(patch: Partial<ToolOptions>): void {
    this.options = { ...this.options, ...patch };
    this.notify();
  }

  undo(): void {
    this.history.undo();
  }
  redo(): void {
    this.history.redo();
  }

  // zoom
  zoomIn(): void {
    this.viewport.zoomAt({ x: this.cssW / 2, y: this.cssH / 2 }, 1.25);
    this.requestRender();
    this.notify();
  }
  zoomOut(): void {
    this.viewport.zoomAt({ x: this.cssW / 2, y: this.cssH / 2 }, 1 / 1.25);
    this.requestRender();
    this.notify();
  }
  fitView(): void {
    this.viewport.fit(this.doc.width, this.doc.height, this.cssW, this.cssH);
    this.requestRender();
    this.notify();
  }
  actualPixels(): void {
    this.viewport.setScaleAt({ x: this.cssW / 2, y: this.cssH / 2 }, 1);
    this.requestRender();
    this.notify();
  }

  toggleSafeArea(): void {
    this.showSafeArea = !this.showSafeArea;
    this.notify();
  }

  // layers
  private pushStructural(label: string, apply: () => void, revert: () => void): void {
    apply();
    this.history.push(makeCommand(label, apply, revert));
    this.requestRender();
    this.notify();
  }

  addRasterLayer(): void {
    const layer = createRasterLayer(this.doc.width, this.doc.height, `Ebene ${this.doc.layers.length + 1}`);
    const at = this.doc.activeLayerId ? this.doc.indexOf(this.doc.activeLayerId) + 1 : this.doc.layers.length;
    const prevActive = this.doc.activeLayerId;
    this.pushStructural(
      'Neue Ebene',
      () => {
        if (this.doc.indexOf(layer.id) < 0) this.doc.layers.splice(at, 0, layer);
        this.doc.activeLayerId = layer.id;
      },
      () => {
        this.doc.removeLayer(layer.id);
        this.doc.activeLayerId = prevActive;
      },
    );
  }

  deleteLayer(id: string): void {
    const idx = this.doc.indexOf(id);
    if (idx < 0 || this.doc.layers.length <= 1) return;
    const layer = this.doc.layers[idx];
    const prevActive = this.doc.activeLayerId;
    this.pushStructural(
      'Ebene löschen',
      () => this.doc.removeLayer(id),
      () => {
        this.doc.layers.splice(idx, 0, layer);
        this.doc.activeLayerId = prevActive;
      },
    );
  }

  selectLayer(id: string): void {
    this.doc.activeLayerId = id;
    this.notify();
  }

  setLayerVisible(id: string, visible: boolean): void {
    const l = this.doc.layerById(id);
    if (!l) return;
    const prev = l.visible;
    this.pushStructural('Sichtbarkeit', () => (l.visible = visible), () => (l.visible = prev));
  }

  setLayerOpacity(id: string, opacity: number): void {
    const l = this.doc.layerById(id);
    if (!l) return;
    l.opacity = opacity;
    this.requestRender();
    this.notify();
  }

  /** Commit an opacity change to history (call on slider release). */
  commitLayerOpacity(id: string, from: number, to: number): void {
    const l = this.doc.layerById(id);
    if (!l || from === to) return;
    this.history.push(makeCommand('Deckkraft', () => (l.opacity = to), () => (l.opacity = from)));
    this.notify();
  }

  setLayerBlend(id: string, mode: BlendMode): void {
    const l = this.doc.layerById(id);
    if (!l) return;
    const prev = l.blendMode;
    this.pushStructural('Blendmodus', () => (l.blendMode = mode), () => (l.blendMode = prev));
  }

  setLayerLocked(id: string, locked: boolean): void {
    const l = this.doc.layerById(id);
    if (!l) return;
    l.locked = locked;
    this.notify();
  }

  renameLayer(id: string, name: string): void {
    const l = this.doc.layerById(id);
    if (!l) return;
    l.name = name;
    this.notify();
  }

  reorderLayer(id: string, toPanelIndex: number): void {
    // Panel is top-first; convert to bottom-first stack index.
    const n = this.doc.layers.length;
    const target = n - 1 - toPanelIndex;
    const from = this.doc.indexOf(id);
    if (from < 0) return;
    this.pushStructural(
      'Ebene umsortieren',
      () => this.doc.moveLayer(id, target),
      () => this.doc.moveLayer(id, from),
    );
  }

  duplicateLayer(id: string): void {
    const l = this.doc.layerById(id);
    if (!l) return;
    const copy: Layer = structuredCloneLayer(l);
    const at = this.doc.indexOf(id) + 1;
    this.pushStructural(
      'Ebene duplizieren',
      () => {
        if (this.doc.indexOf(copy.id) < 0) this.doc.layers.splice(at, 0, copy);
        this.doc.activeLayerId = copy.id;
      },
      () => this.doc.removeLayer(copy.id),
    );
  }

  // selection
  selectAll(): void {
    this.doc.selection = selectionFromRect(this.doc.width, this.doc.height, {
      x: 0,
      y: 0,
      width: this.doc.width,
      height: this.doc.height,
    });
    this.requestRender();
    this.notify();
  }

  clearSelection(): void {
    this.doc.selection = null;
    this.requestRender();
    this.notify();
  }

  invertSelection(): void {
    this.doc.selection?.invert();
    this.requestRender();
    this.notify();
  }

  deleteSelectionContent(): void {
    const layer = this.doc.activeRaster;
    const sel = this.doc.selection;
    if (!layer || !sel || layer.locked) return;
    const before = createCanvas(layer.canvas.width, layer.canvas.height);
    before.ctx.drawImage(layer.canvas, 0, 0);
    const lctx = layer.canvas.getContext('2d')!;
    lctx.save();
    lctx.globalCompositeOperation = 'destination-out';
    lctx.drawImage(sel.toMaskCanvas(), -layer.offsetX, -layer.offsetY);
    lctx.restore();
    const after = createCanvas(layer.canvas.width, layer.canvas.height);
    after.ctx.drawImage(layer.canvas, 0, 0);
    const lc = layer.canvas;
    this.history.push(
      makeCommand(
        'Auswahl löschen',
        () => {
          const c = lc.getContext('2d')!;
          c.clearRect(0, 0, lc.width, lc.height);
          c.drawImage(after.canvas, 0, 0);
        },
        () => {
          const c = lc.getContext('2d')!;
          c.clearRect(0, 0, lc.width, lc.height);
          c.drawImage(before.canvas, 0, 0);
        },
      ),
    );
    this.requestRender();
    this.notify();
  }

  // document & image
  newDocument(width: number, height: number): void {
    this.setDocument(Document.blank(width, height));
  }

  /** Replace the whole document (e.g. after opening a PSD or .jmg project). */
  setDocument(doc: Document): void {
    this.doc = doc;
    this.doc.selection = null;
    this.history.clear();
    this.preview = null;
    this.viewport.fit(doc.width, doc.height, this.cssW, this.cssH);
    this.requestRender();
    this.notify();
  }

  /** Add an imported bitmap as a new raster layer, fit into the document. */
  addImageLayer(bitmap: ImageBitmap | HTMLImageElement | HTMLCanvasElement, name: string): void {
    const layer = createRasterLayer(this.doc.width, this.doc.height, name);
    const ctx = layer.canvas.getContext('2d')!;
    const bw = 'width' in bitmap ? bitmap.width : 0;
    const bh = 'height' in bitmap ? bitmap.height : 0;
    const scale = Math.min(this.doc.width / bw, this.doc.height / bh, 1);
    const w = bw * scale;
    const h = bh * scale;
    ctx.drawImage(bitmap, (this.doc.width - w) / 2, (this.doc.height - h) / 2, w, h);
    const at = this.doc.activeLayerId ? this.doc.indexOf(this.doc.activeLayerId) + 1 : this.doc.layers.length;
    this.pushStructural(
      'Bild importieren',
      () => {
        if (this.doc.indexOf(layer.id) < 0) this.doc.layers.splice(at, 0, layer);
        this.doc.activeLayerId = layer.id;
      },
      () => this.doc.removeLayer(layer.id),
    );
  }

  flattenForExport(): HTMLCanvasElement {
    return this.compositor.flatten(this.doc);
  }

  async exportBytes(format: ImageFormat): Promise<Uint8Array> {
    return encodeCanvas(this.flattenForExport(), format);
  }

  // ---- inline text editing ----------------------------------------------

  private beginTextEdit(layerId: string): void {
    const layer = this.doc.layerById(layerId);
    if (!layer || layer.kind !== 'text') return;
    this.commitTextEdit();
    const el = document.createElement('textarea');
    el.value = layer.style.text;
    el.spellcheck = false;
    Object.assign(el.style, {
      position: 'absolute',
      zIndex: '5',
      margin: '0',
      padding: '0',
      border: '1px dashed var(--primary)',
      background: 'transparent',
      color: 'transparent',
      caretColor: 'var(--primary)',
      outline: 'none',
      resize: 'none',
      overflow: 'hidden',
      whiteSpace: 'pre',
      lineHeight: String(layer.style.lineHeight),
    } as CSSStyleDeclaration);
    this.container.appendChild(el);
    this.textEdit = { el, layerId, before: layer.style.text };
    el.addEventListener('input', () => {
      layer.style.text = el.value;
      this.requestRender();
    });
    el.addEventListener('blur', () => this.commitTextEdit());
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.commitTextEdit();
      }
    });
    this.syncTextEditPosition();
    requestAnimationFrame(() => el.focus());
  }

  private syncTextEditPosition(): void {
    const edit = this.textEdit;
    if (!edit) return;
    const layer = this.doc.layerById(edit.layerId);
    if (!layer || layer.kind !== 'text') return;
    const s = this.viewport.docToScreen({ x: layer.offsetX, y: layer.offsetY });
    const fontPx = layer.style.fontSize * this.viewport.scale;
    Object.assign(edit.el.style, {
      left: `${s.x + layer.style.padding * this.viewport.scale}px`,
      top: `${s.y + layer.style.padding * this.viewport.scale}px`,
      font: `${layer.style.fontWeight} ${fontPx}px ${layer.style.fontFamily}`,
      minWidth: `${Math.max(40, fontPx * 6)}px`,
      height: `${fontPx * layer.style.lineHeight * (edit.el.value.split('\n').length || 1)}px`,
    } as CSSStyleDeclaration);
  }

  private commitTextEdit(): void {
    const edit = this.textEdit;
    if (!edit) return;
    this.textEdit = null;
    edit.el.remove();
    const layer = this.doc.layerById(edit.layerId);
    if (layer && layer.kind === 'text' && layer.style.text !== edit.before) {
      const before = edit.before;
      const after = layer.style.text;
      this.history.push(
        makeCommand('Text bearbeiten', () => (layer.style.text = after), () => (layer.style.text = before)),
      );
    }
    this.requestRender();
    this.notify();
  }

  /**
   * Update a text layer's style live from the properties panel. Style tweaks
   * (font, size, color, alignment, plate) apply immediately and are not pushed
   * to history individually — only text content edits are undoable in Phase 1.
   */
  updateTextStyle(id: string, patch: Partial<TextStyle>): void {
    const l = this.doc.layerById(id);
    if (!l || l.kind !== 'text') return;
    l.style = { ...l.style, ...patch };
    this.requestRender();
    this.notify();
  }

  /** Update a shape layer's style live from the properties panel. */
  updateShapeStyle(id: string, patch: Partial<ShapeStyle>): void {
    const l = this.doc.layerById(id);
    if (!l || l.kind !== 'shape') return;
    l.style = { ...l.style, ...patch };
    this.requestRender();
    this.notify();
  }

  // ---- state mirror ------------------------------------------------------

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }

  getState(): ControllerState {
    const layers: LayerSummary[] = [...this.doc.layers]
      .reverse()
      .map((l) => ({
        id: l.id,
        name: l.name,
        kind: l.kind,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        locked: l.locked,
        isActive: l.id === this.doc.activeLayerId,
        hasMask: !!l.mask,
        thumbnail: layerThumbnail(l, this.doc.width, this.doc.height),
      }));
    return {
      layers,
      activeLayerId: this.doc.activeLayerId,
      toolId: this.tools.activeToolId,
      foreground: rgbToHex(this.foreground),
      background: rgbToHex(this.background),
      brush: { ...this.brush },
      options: this.options,
      zoom: this.viewport.scale,
      hasSelection: !!this.doc.selection && !this.doc.selection.isEmpty(),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      docWidth: this.doc.width,
      docHeight: this.doc.height,
      showSafeArea: this.showSafeArea,
    };
  }
}

/** Deep-clone a layer (including its pixel buffer) for duplication. */
function structuredCloneLayer(layer: Layer): Layer {
  if (layer.kind === 'raster') {
    const copy = createRasterLayer(layer.canvas.width, layer.canvas.height, `${layer.name} Kopie`);
    copy.canvas.getContext('2d')!.drawImage(layer.canvas, 0, 0);
    copy.opacity = layer.opacity;
    copy.blendMode = layer.blendMode;
    copy.offsetX = layer.offsetX;
    copy.offsetY = layer.offsetY;
    copy.visible = layer.visible;
    return copy;
  }
  // text/shape: structuredClone the data, then a fresh id/name.
  const clone = structuredClone({ ...layer, mask: null });
  clone.id = newLayerId();
  clone.name = `${layer.name} Kopie`;
  return clone as Layer;
}
