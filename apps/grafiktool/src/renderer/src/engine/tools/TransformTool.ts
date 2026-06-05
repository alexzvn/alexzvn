import type { Point, Rect, ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import type { Layer } from '../doc/Layer';
import type { OverlayRenderer } from '../render/OverlayRenderer';
import { localToDoc, isIdentityScaleRot } from '../doc/transform';
import { pointInPolygon } from '../geometry';
import { makeCommand } from '../history/commands';

type Mode = 'scale-corner' | 'scale-x' | 'scale-y' | 'rotate' | 'move';
type HandleId = 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l' | 'rotate';

interface Snapshot {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  pivotX: number;
  pivotY: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Local-space content bounding box of a layer (what the gizmo wraps). */
function contentBox(layer: Layer): Rect {
  if (layer.kind === 'shape') return layer.style.bounds;
  if (layer.kind === 'text') {
    measureCtx ??= document.createElement('canvas').getContext('2d');
    const st = layer.style;
    let maxW = 0;
    if (measureCtx) {
      measureCtx.font = `${st.fontWeight} ${st.fontSize}px ${st.fontFamily}`;
      for (const line of st.text.split('\n')) maxW = Math.max(maxW, measureCtx.measureText(line).width);
    }
    const lines = st.text.split('\n').length;
    return {
      x: 0,
      y: 0,
      width: maxW + st.padding * 2,
      height: lines * st.fontSize * st.lineHeight + st.padding * 2,
    };
  }
  // raster: bounding box of non-transparent pixels.
  const { canvas } = layer;
  const ctx = canvas.getContext('2d')!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Free-transform tool: scale (corners/edges), rotate, and move the active layer. */
export class TransformTool implements Tool {
  id: ToolId = 'transform';

  private boxCache: { id: string; box: Rect } | null = null;
  private mode: Mode | null = null;
  private layer: Layer | null = null;
  private start: Snapshot | null = null;
  private center: Point = { x: 0, y: 0 };
  private grabDoc: Point = { x: 0, y: 0 };
  private lastDoc: Point = { x: 0, y: 0 };
  private ux: Point = { x: 1, y: 0 };
  private uy: Point = { x: 0, y: 1 };

  cursor(): string {
    return this.mode === 'rotate' ? 'grabbing' : 'default';
  }

  private box(layer: Layer): Rect {
    if (this.boxCache?.id !== layer.id) this.boxCache = { id: layer.id, box: contentBox(layer) };
    return this.boxCache.box;
  }

  private handles(layer: Layer, box: Rect, viewScale: number): Record<HandleId, Point> & { center: Point } {
    const corner = (lx: number, ly: number) => localToDoc(layer, { x: lx, y: ly });
    const tl = corner(box.x, box.y);
    const tr = corner(box.x + box.width, box.y);
    const br = corner(box.x + box.width, box.y + box.height);
    const bl = corner(box.x, box.y + box.height);
    const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const center = localToDoc(layer, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const t = mid(tl, tr);
    // Outward normal of the top edge for the rotate handle.
    let nx = -(tr.y - tl.y);
    let ny = tr.x - tl.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if ((t.x - center.x) * nx + (t.y - center.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const d = 28 / viewScale;
    return {
      tl,
      tr,
      br,
      bl,
      t,
      r: mid(tr, br),
      b: mid(br, bl),
      l: mid(bl, tl),
      rotate: { x: t.x + nx * d, y: t.y + ny * d },
      center,
    };
  }

  drawOverlay(o: OverlayRenderer, ctx: ToolContext): void {
    const layer = ctx.doc.activeLayer;
    if (!layer) return;
    const h = this.handles(layer, this.box(layer), ctx.viewport.scale);
    o.gizmo([h.tl, h.tr, h.br, h.bl], [h.tl, h.tr, h.br, h.bl, h.t, h.r, h.b, h.l], h.rotate);
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const layer = ctx.doc.activeLayer;
    if (!layer || layer.locked) return;

    // Set the pivot to the box center the first time we transform this layer
    // (safe while identity, since the pivot cancels out then).
    const box = this.box(layer);
    if (isIdentityScaleRot(layer)) {
      layer.pivotX = box.x + box.width / 2;
      layer.pivotY = box.y + box.height / 2;
    }

    const h = this.handles(layer, box, ctx.viewport.scale);
    const hit = this.hitTest(e.screen, h, ctx);

    this.layer = layer;
    this.start = {
      offsetX: layer.offsetX,
      offsetY: layer.offsetY,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      rotation: layer.rotation,
      pivotX: layer.pivotX,
      pivotY: layer.pivotY,
    };
    this.center = { x: layer.offsetX + layer.pivotX, y: layer.offsetY + layer.pivotY };
    this.lastDoc = e.doc;
    const r0 = layer.rotation;
    this.ux = { x: Math.cos(r0), y: Math.sin(r0) };
    this.uy = { x: -Math.sin(r0), y: Math.cos(r0) };

    if (hit === 'rotate') {
      this.mode = 'rotate';
      this.grabDoc = e.doc;
    } else if (hit === 'tl' || hit === 'tr' || hit === 'br' || hit === 'bl') {
      this.mode = 'scale-corner';
      this.grabDoc = h[hit];
    } else if (hit === 'l' || hit === 'r') {
      this.mode = 'scale-x';
      this.grabDoc = h[hit];
    } else if (hit === 't' || hit === 'b') {
      this.mode = 'scale-y';
      this.grabDoc = h[hit];
    } else if (pointInPolygon(e.doc, [h.tl, h.tr, h.br, h.bl])) {
      this.mode = 'move';
    } else {
      this.mode = null;
      this.layer = null;
    }
  }

  private hitTest(screen: Point, h: Record<HandleId, Point> & { center: Point }, ctx: ToolContext): HandleId | null {
    const ids: HandleId[] = ['rotate', 'tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l'];
    for (const id of ids) {
      const s = ctx.viewport.docToScreen(h[id]);
      if (Math.hypot(s.x - screen.x, s.y - screen.y) <= 9) return id;
    }
    return null;
  }

  onPointerMove(e: PointerInfo, ctx: ToolContext): void {
    const layer = this.layer;
    const start = this.start;
    if (!layer || !start || !this.mode) return;
    const C = this.center;

    if (this.mode === 'move') {
      layer.offsetX += e.doc.x - this.lastDoc.x;
      layer.offsetY += e.doc.y - this.lastDoc.y;
      this.lastDoc = e.doc;
    } else if (this.mode === 'rotate') {
      const a0 = Math.atan2(this.grabDoc.y - C.y, this.grabDoc.x - C.x);
      const a1 = Math.atan2(e.doc.y - C.y, e.doc.x - C.x);
      let rot = start.rotation + (a1 - a0);
      if (e.shift) rot = Math.round(rot / (Math.PI / 12)) * (Math.PI / 12);
      layer.rotation = rot;
    } else if (this.mode === 'scale-corner') {
      const d0 = Math.hypot(this.grabDoc.x - C.x, this.grabDoc.y - C.y) || 1;
      const d1 = Math.hypot(e.doc.x - C.x, e.doc.y - C.y);
      const f = Math.max(0.02, d1 / d0);
      layer.scaleX = start.scaleX * f;
      layer.scaleY = start.scaleY * f;
    } else {
      const axis = this.mode === 'scale-x' ? this.ux : this.uy;
      const p0 = (this.grabDoc.x - C.x) * axis.x + (this.grabDoc.y - C.y) * axis.y || 1;
      const p1 = (e.doc.x - C.x) * axis.x + (e.doc.y - C.y) * axis.y;
      const f = Math.max(0.02, Math.abs(p1 / p0));
      if (this.mode === 'scale-x') layer.scaleX = start.scaleX * f;
      else layer.scaleY = start.scaleY * f;
    }
    ctx.requestRender();
  }

  onPointerUp(_e: PointerInfo, ctx: ToolContext): void {
    const layer = this.layer;
    const start = this.start;
    this.mode = null;
    this.layer = null;
    this.start = null;
    if (!layer || !start) return;
    const after: Snapshot = {
      offsetX: layer.offsetX,
      offsetY: layer.offsetY,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      rotation: layer.rotation,
      pivotX: layer.pivotX,
      pivotY: layer.pivotY,
    };
    const same = (Object.keys(after) as (keyof Snapshot)[]).every((k) => after[k] === start[k]);
    if (same) return;
    const set = (s: Snapshot) => {
      layer.offsetX = s.offsetX;
      layer.offsetY = s.offsetY;
      layer.scaleX = s.scaleX;
      layer.scaleY = s.scaleY;
      layer.rotation = s.rotation;
      layer.pivotX = s.pivotX;
      layer.pivotY = s.pivotY;
    };
    ctx.history.push(makeCommand('Transformieren', () => set(after), () => set(start)));
    ctx.layersChanged();
  }

  onPointerLeave(e: PointerInfo, ctx: ToolContext): void {
    if (this.mode) this.onPointerUp(e, ctx);
  }

  /** Drop the cached box when the active layer changes elsewhere. */
  invalidate(): void {
    this.boxCache = null;
  }
}
