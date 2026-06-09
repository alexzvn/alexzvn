import type { RGBA } from '../types';

/** Read a single pixel from ImageData as RGBA. */
export function getPixel(img: ImageData, x: number, y: number): RGBA {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
}

function within(a: RGBA, b: RGBA, tolSq: number): boolean {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = a.a - b.a;
  return dr * dr + dg * dg + db * db + da * da <= tolSq;
}

/**
 * Flood-fill region growing from a seed. Returns a Uint8Array coverage mask
 * (255 = inside) the size of the image. Used by both the fill bucket and the
 * magic-wand selection.
 *
 * @param tolerance 0..255 per-channel-ish similarity threshold.
 * @param contiguous when false, selects ALL matching pixels (global), not just
 *   the connected region.
 */
export function floodFill(
  img: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number,
  contiguous = true,
): Uint8Array {
  const { width, height, data } = img;
  const mask = new Uint8Array(width * height);
  if (seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) return mask;
  const tolSq = tolerance * tolerance * 4;
  const target = getPixel(img, seedX, seedY);

  if (!contiguous) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const c: RGBA = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
        if (within(c, target, tolSq)) mask[y * width + x] = 255;
      }
    }
    return mask;
  }

  // Scanline flood fill (connected region).
  const stack: number[] = [seedX, seedY];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    while (x >= 0 && matches(x, y)) x--;
    x++;
    let spanUp = false;
    let spanDown = false;
    while (x < width && matches(x, y)) {
      mask[y * width + x] = 255;
      if (y > 0) {
        const up = matches(x, y - 1);
        if (up && !spanUp) {
          stack.push(x, y - 1);
          spanUp = true;
        } else if (!up) spanUp = false;
      }
      if (y < height - 1) {
        const down = matches(x, y + 1);
        if (down && !spanDown) {
          stack.push(x, y + 1);
          spanDown = true;
        } else if (!down) spanDown = false;
      }
      x++;
    }
  }
  return mask;

  function matches(x: number, y: number): boolean {
    const idx = y * width + x;
    if (mask[idx]) return false; // already filled
    const i = idx * 4;
    const c: RGBA = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    return within(c, target, tolSq);
  }
}

/** Bounding box of the set pixels in a coverage mask, or null if empty. */
export function maskBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
