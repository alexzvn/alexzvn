import { PDFDocument } from 'pdf-lib';
import type { Slide } from '@shared/types';
import { renderBase } from './pdf';
import { ensureOverlayBitmaps, paintSlide } from './paint';

const EXPORT_WIDTH = 1920; // base raster width per slide
const PAGE_WIDTH_PT = 1280; // PDF page width in points (height follows aspect)

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) throw new Error('Folie konnte nicht gerendert werden.');
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Renders each visible slide (base + overlays) to a high-res raster and assembles
 * them into a PDF. Overlays are baked in — WYSIWYG with the editor/audience view.
 */
export async function exportSlidesToPdf(slides: Slide[]): Promise<Uint8Array> {
  const visible = slides.filter((s) => !s.hidden);
  if (visible.length === 0) throw new Error('Keine sichtbaren Folien zum Exportieren.');

  await ensureOverlayBitmaps(visible);
  const pdf = await PDFDocument.create();

  for (const slide of visible) {
    const base = await renderBase(slide.sourceId, slide.pageIndex, EXPORT_WIDTH);
    const target = document.createElement('canvas');
    target.width = base.width;
    target.height = base.height;
    const ctx = target.getContext('2d')!;
    paintSlide(ctx, base.canvas, slide, base.width, base.height);

    const png = await pdf.embedPng(await canvasToPng(target));
    const pageH = PAGE_WIDTH_PT / base.aspect;
    const page = pdf.addPage([PAGE_WIDTH_PT, pageH]);
    page.drawImage(png, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: pageH });
  }

  return pdf.save();
}
