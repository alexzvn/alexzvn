import { PDFDocument, type PDFEmbeddedPage, type PDFImage, type PDFPage } from 'pdf-lib';
import type { Slide } from '@shared/types';
import { getSource } from './assets';
import { renderBase } from './pdf';
import { ensureOverlayBitmaps, paintOverlays, paintSlide } from './paint';

const PAGE_WIDTH_PT = 1280; // PDF page width in points (height follows aspect)
const OVERLAY_RASTER_WIDTH = 2560; // overlay layer resolution (2× page → crisp)
const FALLBACK_RASTER_WIDTH = 1920; // last-resort full raster if a page won't embed

function pngFrom(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(async (b) => {
      if (!b) return reject(new Error('Folie konnte nicht gerendert werden.'));
      resolve(new Uint8Array(await b.arrayBuffer()));
    }, 'image/png'),
  );
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** PNG/JPEG are embeddable by pdf-lib as-is; anything else must be rasterised. */
function imageFormat(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  return null;
}

/** Stamp the overlay layer (transparent) over a page that already has a background. */
async function drawOverlayLayer(
  pdf: PDFDocument,
  page: PDFPage,
  slide: Slide,
  pageW: number,
  pageH: number,
): Promise<void> {
  if (slide.overlays.length === 0) return;
  const canvas = newCanvas(OVERLAY_RASTER_WIDTH, OVERLAY_RASTER_WIDTH / (pageW / pageH));
  const ctx = canvas.getContext('2d')!;
  paintOverlays(ctx, slide, canvas.width, canvas.height);
  const png = await pdf.embedPng(await pngFrom(canvas));
  page.drawImage(png, { x: 0, y: 0, width: pageW, height: pageH });
}

/**
 * Exports the visible slides to a PDF, keeping vector content vector: imported
 * PDF/Office pages are embedded as real PDF pages (crisp, selectable, small),
 * images are embedded losslessly, and only the user's overlays are stamped on top
 * as a high-res transparent layer. Slides with no overlays come out fully vector.
 * A slide whose source can't be embedded falls back to a full raster so export
 * never fails outright.
 */
export async function exportSlidesToPdf(slides: Slide[]): Promise<Uint8Array> {
  const visible = slides.filter((s) => !s.hidden);
  if (visible.length === 0) throw new Error('Keine sichtbaren Folien zum Exportieren.');

  await ensureOverlayBitmaps(visible);
  const pdf = await PDFDocument.create();

  // Cache embedded pages per source:page so a reused page is embedded once.
  const pageCache = new Map<string, PDFEmbeddedPage>();
  const imageCache = new Map<string, PDFImage>();

  for (const slide of visible) {
    const entry = getSource(slide.sourceId);
    try {
      if (entry?.kind === 'pdf') {
        const key = `${slide.sourceId}:${slide.pageIndex}`;
        let embedded = pageCache.get(key);
        if (!embedded) {
          [embedded] = await pdf.embedPdf(entry.bytes.slice(), [slide.pageIndex]);
          pageCache.set(key, embedded);
        }
        const aspect = embedded.width / embedded.height;
        const pageH = PAGE_WIDTH_PT / aspect;
        const page = pdf.addPage([PAGE_WIDTH_PT, pageH]);
        page.drawPage(embedded, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: pageH });
        await drawOverlayLayer(pdf, page, slide, PAGE_WIDTH_PT, pageH);
        continue;
      }

      if (entry?.kind === 'image') {
        const fmt = imageFormat(entry.bytes);
        let img = imageCache.get(slide.sourceId);
        if (!img && fmt) {
          img =
            fmt === 'png'
              ? await pdf.embedPng(entry.bytes.slice())
              : await pdf.embedJpg(entry.bytes.slice());
          imageCache.set(slide.sourceId, img);
        }
        if (img) {
          const aspect = img.width / img.height;
          const pageH = PAGE_WIDTH_PT / aspect;
          const page = pdf.addPage([PAGE_WIDTH_PT, pageH]);
          page.drawImage(img, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: pageH });
          await drawOverlayLayer(pdf, page, slide, PAGE_WIDTH_PT, pageH);
          continue;
        }
        // Unsupported image format (webp/gif): rasterise the base losslessly.
        const base = await renderBase(slide.sourceId, slide.pageIndex, FALLBACK_RASTER_WIDTH);
        const png = await pdf.embedPng(await pngFrom(base.canvas));
        const pageH = PAGE_WIDTH_PT / base.aspect;
        const page = pdf.addPage([PAGE_WIDTH_PT, pageH]);
        page.drawImage(png, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: pageH });
        await drawOverlayLayer(pdf, page, slide, PAGE_WIDTH_PT, pageH);
        continue;
      }

      throw new Error(`Quelle ${slide.sourceId} fehlt`);
    } catch {
      // Robust fallback: render the whole slide (base + overlays) to a raster so a
      // single problematic page never aborts the export.
      const base = await renderBase(slide.sourceId, slide.pageIndex, FALLBACK_RASTER_WIDTH);
      const target = newCanvas(base.width, base.height);
      paintSlide(target.getContext('2d')!, base.canvas, slide, base.width, base.height);
      const png = await pdf.embedPng(await pngFrom(target));
      const pageH = PAGE_WIDTH_PT / base.aspect;
      const page = pdf.addPage([PAGE_WIDTH_PT, pageH]);
      page.drawImage(png, { x: 0, y: 0, width: PAGE_WIDTH_PT, height: pageH });
    }
  }

  return pdf.save();
}
