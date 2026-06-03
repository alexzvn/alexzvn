import type { Layer, RasterLayer } from './Layer';
import { createRasterLayer } from './Layer';
import type { Selection } from '../selection/Selection';

/**
 * The document aggregate: canvas size, the ordered layer stack (index 0 =
 * bottom), the active layer, and the current selection. Pure data + structural
 * helpers — rendering lives in the compositor, history/undo in History. The
 * EditorController owns change notification.
 */
export class Document {
  width: number;
  height: number;
  layers: Layer[] = [];
  activeLayerId: string | null = null;
  selection: Selection | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /** Create a blank document with one empty raster layer. */
  static blank(width: number, height: number): Document {
    const doc = new Document(width, height);
    const layer = createRasterLayer(width, height, 'Hintergrund');
    doc.layers.push(layer);
    doc.activeLayerId = layer.id;
    return doc;
  }

  get activeLayer(): Layer | null {
    return this.layers.find((l) => l.id === this.activeLayerId) ?? null;
  }

  /** Active layer if it is a raster layer, else null (paint tools need this). */
  get activeRaster(): RasterLayer | null {
    const l = this.activeLayer;
    return l && l.kind === 'raster' ? l : null;
  }

  layerById(id: string): Layer | null {
    return this.layers.find((l) => l.id === id) ?? null;
  }

  indexOf(id: string): number {
    return this.layers.findIndex((l) => l.id === id);
  }

  /** Insert a layer directly above the active layer and make it active. */
  addLayer(layer: Layer): void {
    const at = this.activeLayerId ? this.indexOf(this.activeLayerId) + 1 : this.layers.length;
    this.layers.splice(at, 0, layer);
    this.activeLayerId = layer.id;
  }

  removeLayer(id: string): Layer | null {
    const idx = this.indexOf(id);
    if (idx < 0) return null;
    const [removed] = this.layers.splice(idx, 1);
    if (this.activeLayerId === id) {
      const next = this.layers[idx] ?? this.layers[idx - 1] ?? null;
      this.activeLayerId = next ? next.id : null;
    }
    return removed;
  }

  /** Move a layer to a new index in the stack (clamped). */
  moveLayer(id: string, toIndex: number): void {
    const from = this.indexOf(id);
    if (from < 0) return;
    const [layer] = this.layers.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, this.layers.length));
    this.layers.splice(clamped, 0, layer);
  }
}
