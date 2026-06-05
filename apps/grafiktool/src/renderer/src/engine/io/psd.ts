import { readPsd, writePsd, type Layer as PsdLayer } from 'ag-psd';
import type { BlendMode, RGBA, TextStyle } from '../types';
import { Document } from '../doc/Document';
import { createRasterLayer, createTextLayer, type TextLayer } from '../doc/Layer';
import { renderLayerToCanvas } from './layerRender';

// Our blend modes use CSS hyphenated names; PSD/ag-psd use spaced names.
const TO_PSD: Record<BlendMode, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
  'color-burn': 'color burn',
  'hard-light': 'hard light',
  'soft-light': 'soft light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

const FROM_PSD: Record<string, BlendMode> = {
  ...Object.fromEntries(Object.entries(TO_PSD).map(([k, v]) => [v, k as BlendMode])),
  'linear dodge': 'color-dodge',
  'linear burn': 'color-burn',
  'vivid light': 'hard-light',
  'linear light': 'hard-light',
  'pin light': 'hard-light',
};

/** Serialize the document to PSD bytes, one PSD layer per editor layer. */
export function docToPsdBytes(doc: Document, flattened: HTMLCanvasElement): Uint8Array {
  const children: PsdLayer[] = doc.layers.map((l) => ({
    name: l.name,
    opacity: l.opacity,
    hidden: !l.visible,
    blendMode: TO_PSD[l.blendMode] as PsdLayer['blendMode'],
    left: 0,
    top: 0,
    canvas: renderLayerToCanvas(l, doc.width, doc.height),
  }));

  const buffer = writePsd(
    { width: doc.width, height: doc.height, children, canvas: flattened },
    { generateThumbnail: true, noBackground: true },
  );
  return new Uint8Array(buffer);
}

/**
 * Build an editable text layer from an ag-psd text layer, best-effort. PSD's
 * type engine is rich; we map the common attributes (content, font, size,
 * color, alignment, position) so the text stays editable. Exact glyph metrics
 * may differ from Photoshop's render — the user can fine-tune.
 */
function psdTextLayer(layer: PsdLayer): TextLayer | null {
  const t = layer.text;
  if (!t || typeof t.text !== 'string') return null;
  const style = t.style ?? {};
  const transform = t.transform ?? [1, 0, 0, 1, 0, 0];
  const scaleY = Math.abs(transform[3] || 1);
  const fontSize = Math.max(4, Math.round((style.fontSize ?? 72) * scaleY));

  const fc = style.fillColor as { r?: number; g?: number; b?: number } | undefined;
  const color: RGBA = fc
    ? { r: Math.round(fc.r ?? 0), g: Math.round(fc.g ?? 0), b: Math.round(fc.b ?? 0), a: 255 }
    : { r: 0, g: 0, b: 0, a: 255 };

  const fontName = style.font?.name;
  const fontFamily = fontName ? `"${fontName.replace(/-/g, ' ')}"` : '"Manrope Variable", system-ui, sans-serif';
  const bold = !!style.fauxBold || /bold|black|heavy|semibold/i.test(fontName ?? '');

  const just = (t.paragraphStyle?.justification ?? '').toString().toLowerCase();
  const align: TextStyle['align'] = just.includes('center') ? 'center' : just.includes('right') ? 'right' : 'left';

  const ts: TextStyle = {
    text: t.text.replace(/\r/g, '\n'),
    fontFamily,
    fontSize,
    fontWeight: bold ? 700 : 400,
    color,
    align,
    lineHeight: 1.2,
    background: null,
    padding: 0,
  };
  const tl = createTextLayer(ts, layer.name || 'Text');
  // Position from the layer's pixel bounds (falls back to the text transform).
  tl.offsetX = layer.left ?? Math.round(transform[4] ?? 0);
  tl.offsetY = layer.top ?? Math.round((transform[5] ?? 0) - fontSize);
  return tl;
}

/** Build a raster layer from a PSD layer's composited canvas. */
function rasterFromPsd(layer: PsdLayer, w: number, h: number) {
  if (!layer.canvas) return null;
  const rl = createRasterLayer(w, h, layer.name || 'Ebene');
  rl.canvas.getContext('2d')!.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
  return rl;
}

/** Parse PSD bytes into a document. Text layers become editable text; other
 *  layers are imported as raster (flattened per layer) to preserve fidelity;
 *  groups are flattened into their layers. */
export function psdToDoc(bytes: Uint8Array): Document {
  const psd = readPsd(new Uint8Array(bytes).buffer, {
    skipThumbnail: true,
    skipLinkedFilesData: true,
    useImageData: false,
  });
  const doc = new Document(psd.width, psd.height);

  const walk = (layers: PsdLayer[] | undefined): void => {
    if (!layers) return;
    for (const layer of layers) {
      if (layer.children) {
        walk(layer.children);
        continue;
      }
      const textLayer = psdTextLayer(layer);
      const created = textLayer ?? rasterFromPsd(layer, psd.width, psd.height);
      if (!created) continue;
      created.opacity = layer.opacity ?? 1;
      created.visible = !layer.hidden;
      created.blendMode = (layer.blendMode && FROM_PSD[layer.blendMode]) || 'normal';
      doc.layers.push(created);
    }
  };
  walk(psd.children);

  if (doc.layers.length === 0) {
    const blank = createRasterLayer(psd.width, psd.height, 'Hintergrund');
    // If the PSD had only a flattened composite, use it.
    if (psd.canvas) blank.canvas.getContext('2d')!.drawImage(psd.canvas, 0, 0);
    doc.layers.push(blank);
  }
  doc.activeLayerId = doc.layers[doc.layers.length - 1]?.id ?? null;
  return doc;
}
