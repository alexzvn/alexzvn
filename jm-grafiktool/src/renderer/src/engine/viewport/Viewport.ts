import type { Point } from '../types';
import { clamp } from '../geometry';

const MIN_SCALE = 0.02;
const MAX_SCALE = 32;

/**
 * Pan/zoom transform between screen (CSS px in the viewport element) and
 * document space. Document point d maps to screen point s as
 * `s = d * scale + (tx, ty)`. The compositor draws the document at this scale;
 * layer pixels are never touched for view changes.
 */
export class Viewport {
  scale = 1;
  tx = 0;
  ty = 0;

  screenToDoc(p: Point): Point {
    return { x: (p.x - this.tx) / this.scale, y: (p.y - this.ty) / this.scale };
  }

  docToScreen(p: Point): Point {
    return { x: p.x * this.scale + this.tx, y: p.y * this.scale + this.ty };
  }

  pan(dx: number, dy: number): void {
    this.tx += dx;
    this.ty += dy;
  }

  /** Zoom by `factor` keeping the document point under `anchor` (screen) fixed. */
  zoomAt(anchor: Point, factor: number): void {
    const next = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    const docPt = this.screenToDoc(anchor);
    this.scale = next;
    this.tx = anchor.x - docPt.x * next;
    this.ty = anchor.y - docPt.y * next;
  }

  setScaleAt(anchor: Point, scale: number): void {
    this.zoomAt(anchor, clamp(scale, MIN_SCALE, MAX_SCALE) / this.scale);
  }

  /** Fit and center a document of size (docW, docH) into the viewport. */
  fit(docW: number, docH: number, viewW: number, viewH: number, padding = 40): void {
    const sw = (viewW - padding * 2) / docW;
    const sh = (viewH - padding * 2) / docH;
    this.scale = clamp(Math.min(sw, sh), MIN_SCALE, MAX_SCALE);
    this.tx = (viewW - docW * this.scale) / 2;
    this.ty = (viewH - docH * this.scale) / 2;
  }
}
