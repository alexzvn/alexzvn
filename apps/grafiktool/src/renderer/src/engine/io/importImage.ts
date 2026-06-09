import * as UTIF from 'utif';
import { createCanvas } from '../canvas';

/** Decode arbitrary raster bytes (PNG/JPG/WebP/GIF/BMP) into an ImageBitmap. */
export function decodeToBitmap(bytes: Uint8Array): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart]));
}

/** Decode raster bytes into a same-size canvas. */
export async function bytesToCanvas(bytes: Uint8Array): Promise<HTMLCanvasElement> {
  const bmp = await decodeToBitmap(bytes);
  const { canvas, ctx } = createCanvas(bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return canvas;
}

/** Load an SVG (vector) and rasterize it via an <img> element. */
export function loadSvg(bytes: Uint8Array): Promise<HTMLImageElement> {
  const blob = new Blob([bytes as BlobPart], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG konnte nicht geladen werden'));
    };
    img.src = url;
  });
}

/** Decode a TIFF (first page) into a canvas via utif. */
export function tiffToCanvas(bytes: Uint8Array): HTMLCanvasElement {
  const ifds = UTIF.decode(bytes);
  if (!ifds.length) throw new Error('TIFF enthält keine Bilddaten');
  const first = ifds[0];
  UTIF.decodeImage(bytes, first);
  const rgba = UTIF.toRGBA8(first);
  const { canvas, ctx } = createCanvas(first.width, first.height);
  const img = ctx.createImageData(first.width, first.height);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return canvas;
}
