import type { Point, Rect } from '../types';
import { Selection } from './Selection';
import { pointInPolygon, snapRectToDoc } from '../geometry';
import { floodFill } from '../raster/PixelOps';

/** Rectangular marquee selection. */
export function selectionFromRect(docW: number, docH: number, rect: Rect): Selection {
  const r = snapRectToDoc(rect, docW, docH);
  const data = new Uint8Array(docW * docH);
  for (let y = r.y; y < r.y + r.height; y++) {
    const row = y * docW;
    for (let x = r.x; x < r.x + r.width; x++) data[row + x] = 255;
  }
  const outline: Point[] = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
  return new Selection(docW, docH, data, [outline]);
}

/** Freehand lasso selection from a closed polygon. */
export function selectionFromPolygon(docW: number, docH: number, points: Point[]): Selection {
  const data = new Uint8Array(docW * docH);
  if (points.length >= 3) {
    let minX = docW;
    let minY = docH;
    let maxX = 0;
    let maxY = 0;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(docW - 1, Math.ceil(maxX));
    maxY = Math.min(docH - 1, Math.ceil(maxY));
    for (let y = minY; y <= maxY; y++) {
      const row = y * docW;
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, points)) data[row + x] = 255;
      }
    }
  }
  return new Selection(docW, docH, data, [points]);
}

/** Magic-wand selection by color similarity on the given image data. */
export function selectionFromWand(
  img: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number,
  contiguous = true,
): Selection {
  const mask = floodFill(img, seedX, seedY, tolerance, contiguous);
  // Reuse the flood mask directly as coverage; no outline (overlay uses bbox).
  return new Selection(img.width, img.height, mask, null);
}
