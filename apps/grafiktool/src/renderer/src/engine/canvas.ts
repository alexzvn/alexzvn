// Small helpers around HTMLCanvasElement so the rest of the engine doesn't
// repeat the create/get-context boilerplate (and we can centralize the
// willReadFrequently hint that paint/selection ops rely on).

export interface Canvas2D {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function createCanvas(width: number, height: number): Canvas2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

/** Deep-copy a canvas into a fresh one of the same size. */
export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  return canvas;
}

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
