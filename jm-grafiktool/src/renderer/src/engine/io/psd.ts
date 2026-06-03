import { readPsd, writePsd, type Layer as PsdLayer } from 'ag-psd';
import type { BlendMode } from '../types';
import { Document } from '../doc/Document';
import { createRasterLayer } from '../doc/Layer';
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

/** Parse PSD bytes into a document. Layers are imported as raster (flattened
 *  per layer) to preserve fidelity; groups are flattened into their layers. */
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
      if (!layer.canvas) continue;
      const rl = createRasterLayer(psd.width, psd.height, layer.name || 'Ebene');
      rl.canvas.getContext('2d')!.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
      rl.opacity = layer.opacity ?? 1;
      rl.visible = !layer.hidden;
      rl.blendMode = (layer.blendMode && FROM_PSD[layer.blendMode]) || 'normal';
      doc.layers.push(rl);
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
