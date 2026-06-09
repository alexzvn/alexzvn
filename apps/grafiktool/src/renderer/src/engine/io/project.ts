import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { BlendMode, ShapeStyle, TextStyle } from '../types';
import type { Layer } from '../doc/Layer';
import { Document } from '../doc/Document';
import { createRasterLayer, createShapeLayer, createTextLayer } from '../doc/Layer';
import { encodeCanvas } from './exportRaster';
import { bytesToCanvas } from './importImage';

const SCHEMA_VERSION = 1;

interface LayerMetaBase {
  id: string;
  kind: Layer['kind'];
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  pivotX: number;
  pivotY: number;
  locked: boolean;
  hasMask: boolean;
}
interface TextMeta extends LayerMetaBase {
  kind: 'text';
  style: TextStyle;
}
interface ShapeMeta extends LayerMetaBase {
  kind: 'shape';
  style: ShapeStyle;
}
type LayerMeta = LayerMetaBase | TextMeta | ShapeMeta;

interface Manifest {
  schemaVersion: number;
  width: number;
  height: number;
  activeLayerId: string | null;
  layers: LayerMeta[];
}

/** Serialize a document to a `.jmg` ZIP container (manifest + layer PNGs). */
export async function docToJmgBytes(doc: Document): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const layers: LayerMeta[] = [];

  for (const l of doc.layers) {
    const base: LayerMetaBase = {
      id: l.id,
      kind: l.kind,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      offsetX: l.offsetX,
      offsetY: l.offsetY,
      scaleX: l.scaleX,
      scaleY: l.scaleY,
      rotation: l.rotation,
      pivotX: l.pivotX,
      pivotY: l.pivotY,
      locked: l.locked,
      hasMask: !!l.mask,
    };
    if (l.mask) files[`masks/${l.id}.png`] = await encodeCanvas(l.mask, 'png');
    if (l.kind === 'raster') {
      files[`layers/${l.id}.png`] = await encodeCanvas(l.canvas, 'png');
      layers.push(base);
    } else if (l.kind === 'text') {
      layers.push({ ...base, kind: 'text', style: l.style });
    } else {
      layers.push({ ...base, kind: 'shape', style: l.style });
    }
  }

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    width: doc.width,
    height: doc.height,
    activeLayerId: doc.activeLayerId,
    layers,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(files, { level: 6 });
}

/** Rebuild a document from `.jmg` bytes. */
export async function jmgToDoc(bytes: Uint8Array): Promise<Document> {
  const files = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as Manifest;
  const doc = new Document(manifest.width, manifest.height);

  for (const meta of manifest.layers) {
    let layer: Layer;
    if (meta.kind === 'text') {
      layer = createTextLayer((meta as TextMeta).style, meta.name);
    } else if (meta.kind === 'shape') {
      layer = createShapeLayer((meta as ShapeMeta).style, meta.name);
    } else {
      const rl = createRasterLayer(manifest.width, manifest.height, meta.name);
      const png = files[`layers/${meta.id}.png`];
      if (png) {
        const decoded = await bytesToCanvas(png);
        rl.canvas.getContext('2d')!.drawImage(decoded, 0, 0);
      }
      layer = rl;
    }
    if (meta.hasMask && files[`masks/${meta.id}.png`]) {
      layer.mask = await bytesToCanvas(files[`masks/${meta.id}.png`]);
    }
    layer.id = meta.id;
    layer.visible = meta.visible;
    layer.opacity = meta.opacity;
    layer.blendMode = meta.blendMode;
    layer.offsetX = meta.offsetX;
    layer.offsetY = meta.offsetY;
    layer.scaleX = meta.scaleX ?? 1;
    layer.scaleY = meta.scaleY ?? 1;
    layer.rotation = meta.rotation ?? 0;
    layer.pivotX = meta.pivotX ?? 0;
    layer.pivotY = meta.pivotY ?? 0;
    layer.locked = meta.locked;
    doc.layers.push(layer);
  }

  doc.activeLayerId =
    manifest.activeLayerId && doc.layerById(manifest.activeLayerId)
      ? manifest.activeLayerId
      : (doc.layers[doc.layers.length - 1]?.id ?? null);
  return doc;
}
