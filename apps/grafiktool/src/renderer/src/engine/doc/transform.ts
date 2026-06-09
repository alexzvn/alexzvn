import type { Point } from '../types';

/** The affine-transform fields every layer carries. */
export interface Transformable {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  /** Rotation in radians. */
  rotation: number;
  /** Pivot (scale/rotation center) in local content space. */
  pivotX: number;
  pivotY: number;
}

/**
 * Build the local→document matrix:
 *   M = T(offset) · T(pivot) · R(rot) · S(scale) · T(-pivot)
 * With scale=1, rot=0 this reduces to a pure translation by `offset`, so
 * untransformed layers behave exactly as before. The pivot maps to
 * `offset + pivot` regardless of scale/rotation, i.e. it's the fixed center.
 */
export function layerMatrix(t: Transformable): DOMMatrix {
  const m = new DOMMatrix();
  m.translateSelf(t.offsetX + t.pivotX, t.offsetY + t.pivotY);
  m.rotateSelf((t.rotation * 180) / Math.PI);
  m.scaleSelf(t.scaleX, t.scaleY);
  m.translateSelf(-t.pivotX, -t.pivotY);
  return m;
}

export function localToDoc(t: Transformable, p: Point): Point {
  const m = layerMatrix(t);
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

export function docToLocal(t: Transformable, p: Point): Point {
  const inv = layerMatrix(t).inverse();
  return { x: inv.a * p.x + inv.c * p.y + inv.e, y: inv.b * p.x + inv.d * p.y + inv.f };
}

/** Whether the transform is a pure translation (no scale/rotation). */
export function isIdentityScaleRot(t: Transformable): boolean {
  return t.scaleX === 1 && t.scaleY === 1 && t.rotation === 0;
}
