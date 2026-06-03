import type { Point, Rect } from '../types';
import type { Viewport } from '../viewport/Viewport';
import type { Selection } from '../selection/Selection';

/**
 * Draws transient/interactive feedback (selection marching ants, tool previews,
 * crop dimming, safe-area guides) onto the overlay canvas above the document.
 * All inputs are in document coordinates; conversion to screen happens here.
 */
export class OverlayRenderer {
  private dashOffset = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private viewport: Viewport,
  ) {}

  begin(dashOffset: number, dpr = 1): void {
    this.dashOffset = dashOffset;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private s(p: Point): Point {
    return this.viewport.docToScreen(p);
  }

  private rectScreen(r: Rect): Rect {
    const o = this.s({ x: r.x, y: r.y });
    return { x: o.x, y: o.y, width: r.width * this.viewport.scale, height: r.height * this.viewport.scale };
  }

  /** A dashed rectangle outline in document space (marquee/shape preview). */
  dashedRect(r: Rect, color = '#ffffff'): void {
    const s = this.rectScreen(r);
    const c = this.ctx;
    c.save();
    c.lineWidth = 1;
    c.strokeStyle = '#000';
    c.setLineDash([4, 4]);
    c.strokeRect(s.x + 0.5, s.y + 0.5, s.width, s.height);
    c.strokeStyle = color;
    c.lineDashOffset = this.dashOffset;
    c.strokeRect(s.x + 0.5, s.y + 0.5, s.width, s.height);
    c.restore();
  }

  /** A polyline (lasso/line preview) in document space. */
  polyline(points: Point[], closed: boolean, color = '#ffffff'): void {
    if (points.length < 2) return;
    const c = this.ctx;
    c.save();
    c.beginPath();
    points.forEach((p, i) => {
      const s = this.s(p);
      if (i === 0) c.moveTo(s.x, s.y);
      else c.lineTo(s.x, s.y);
    });
    if (closed) c.closePath();
    c.lineWidth = 1;
    c.strokeStyle = '#000';
    c.setLineDash([4, 4]);
    c.stroke();
    c.strokeStyle = color;
    c.lineDashOffset = this.dashOffset;
    c.stroke();
    c.restore();
  }

  /** Selection marching ants: exact outlines when available, else bounding box. */
  selection(sel: Selection): void {
    if (sel.outlines) {
      for (const poly of sel.outlines) this.polyline(poly, true, '#ffe54a');
    } else {
      const b = sel.bounds();
      if (b) this.dashedRect(b, '#ffe54a');
    }
  }

  /** Crop overlay: dim everything outside the rect and outline it. */
  cropPreview(rect: Rect, docW: number, docH: number): void {
    const c = this.ctx;
    const full = this.rectScreen({ x: 0, y: 0, width: docW, height: docH });
    const r = this.rectScreen(rect);
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.beginPath();
    c.rect(full.x, full.y, full.width, full.height);
    c.rect(r.x, r.y, r.width, r.height);
    c.fill('evenodd');
    c.restore();
    this.dashedRect(rect);
  }

  /** Title/action-safe guides (already document-space rects). */
  safeAreas(rects: { rect: Rect; color: string }[]): void {
    const c = this.ctx;
    c.save();
    c.setLineDash([]);
    c.lineWidth = 1;
    for (const g of rects) {
      const s = this.rectScreen(g.rect);
      c.strokeStyle = g.color;
      c.strokeRect(s.x + 0.5, s.y + 0.5, s.width, s.height);
    }
    c.restore();
  }

  /**
   * Free-transform gizmo: the (possibly rotated) bounding box, square scale
   * handles, and a round rotation handle above the top edge. All points are in
   * document space.
   */
  gizmo(corners: Point[], handles: Point[], rotate: Point | null): void {
    if (corners.length < 4) return;
    const c = this.ctx;
    c.save();
    c.setLineDash([]);
    // Box outline.
    c.beginPath();
    corners.forEach((p, i) => {
      const s = this.s(p);
      if (i === 0) c.moveTo(s.x, s.y);
      else c.lineTo(s.x, s.y);
    });
    c.closePath();
    c.strokeStyle = 'rgba(255,229,74,0.9)';
    c.lineWidth = 1.5;
    c.stroke();

    // Line to the rotation handle.
    if (rotate) {
      const topMid = this.s({ x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 });
      const rs = this.s(rotate);
      c.beginPath();
      c.moveTo(topMid.x, topMid.y);
      c.lineTo(rs.x, rs.y);
      c.stroke();
    }

    // Square scale handles.
    for (const h of handles) {
      const s = this.s(h);
      c.beginPath();
      c.rect(s.x - 4, s.y - 4, 8, 8);
      c.fillStyle = '#1a1a1a';
      c.fill();
      c.strokeStyle = '#ffe54a';
      c.lineWidth = 1.5;
      c.stroke();
    }

    // Round rotation handle.
    if (rotate) {
      const rs = this.s(rotate);
      c.beginPath();
      c.arc(rs.x, rs.y, 5, 0, Math.PI * 2);
      c.fillStyle = '#1a1a1a';
      c.fill();
      c.strokeStyle = '#ffe54a';
      c.stroke();
    }
    c.restore();
  }

  /** Document border so the canvas bounds are visible against the checker. */
  documentBorder(docW: number, docH: number): void {
    const s = this.rectScreen({ x: 0, y: 0, width: docW, height: docH });
    const c = this.ctx;
    c.save();
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.lineWidth = 1;
    c.strokeRect(s.x - 0.5, s.y - 0.5, s.width + 1, s.height + 1);
    c.restore();
  }
}
