import type { ImageFormat } from '@shared/types';

const MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** Encode a flattened canvas to image bytes in the requested format. */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality = 0.92,
): Promise<Uint8Array> {
  // JPEG has no alpha — flatten onto white so transparent areas don't go black.
  let source = canvas;
  if (format === 'jpg') {
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    source = flat;
  }
  const blob = await new Promise<Blob | null>((res) => source.toBlob(res, MIME[format], quality));
  if (!blob) throw new Error('Bild konnte nicht kodiert werden');
  return new Uint8Array(await blob.arrayBuffer());
}
