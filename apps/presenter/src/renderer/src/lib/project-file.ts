import { unzipSync, zipSync } from 'fflate';
import type { ProjectDoc } from '@shared/types';
import {
  clearAssets,
  getImageBytes,
  getSource,
  putImage,
  putSource,
} from './assets';
import { clearPdfCaches } from './pdf';

const SCHEMA_VERSION = 1;
const MANIFEST = 'manifest.json';

/**
 * Serialises the project into a self-contained .jmpres ZIP: a manifest plus the
 * raw bytes of every source document and overlay image it references.
 */
export function serializeProject(doc: ProjectDoc): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  files[MANIFEST] = enc.encode(JSON.stringify({ ...doc, schemaVersion: SCHEMA_VERSION }, null, 2));

  for (const src of doc.sources) {
    const entry = getSource(src.id);
    if (entry) files[`sources/${src.id}`] = entry.bytes;
  }

  const imageIds = new Set<string>();
  for (const slide of doc.slides) {
    for (const o of slide.overlays) if (o.kind === 'image' && o.imageId) imageIds.add(o.imageId);
  }
  for (const id of imageIds) {
    const bytes = getImageBytes(id);
    if (bytes) files[`images/${id}`] = bytes;
  }

  // level 0 — sources are PDFs/PNGs/JPEGs that are already compressed.
  return zipSync(files, { level: 0 });
}

/**
 * Loads a .jmpres ZIP: resets the asset registry, registers all bytes and
 * returns the project document. Caches are cleared so stale renders are dropped.
 */
export function deserializeProject(bytes: Uint8Array): ProjectDoc {
  const files = unzipSync(bytes);
  const manifestBytes = files[MANIFEST];
  if (!manifestBytes) throw new Error('Ungültiges Projekt: manifest.json fehlt.');
  const doc = JSON.parse(new TextDecoder().decode(manifestBytes)) as ProjectDoc;

  clearPdfCaches();
  clearAssets();

  for (const src of doc.sources) {
    const data = files[`sources/${src.id}`];
    if (data) putSource(src.id, src.kind, data);
  }
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('images/')) putImage(name.slice('images/'.length), data);
  }

  return doc;
}
