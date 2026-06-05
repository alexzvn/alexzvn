import type { BlendMode, LayerKind, RGBA, ShapeStyle, TextStyle } from '../types';
import { createCanvas } from '../canvas';

export interface LayerBase {
  id: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  /** 0..1 */
  opacity: number;
  blendMode: BlendMode;
  /** Translation in document space. */
  offsetX: number;
  offsetY: number;
  /** Non-destructive scale (default 1) and rotation in radians (default 0). */
  scaleX: number;
  scaleY: number;
  rotation: number;
  /** Scale/rotation pivot in local content space (center). */
  pivotX: number;
  pivotY: number;
  locked: boolean;
  /**
   * Optional alpha mask, document-sized. Its alpha channel hides/reveals the
   * layer (white/opaque = visible). This is where Magic Mask (Phase 3) writes.
   */
  mask: HTMLCanvasElement | null;
}

export interface RasterLayer extends LayerBase {
  kind: 'raster';
  /** Document-sized pixel buffer; paint tools draw directly here. */
  canvas: HTMLCanvasElement;
}

export interface TextLayer extends LayerBase {
  kind: 'text';
  style: TextStyle;
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape';
  style: ShapeStyle;
}

export type Layer = RasterLayer | TextLayer | ShapeLayer;

let counter = 0;
export function newLayerId(): string {
  counter += 1;
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${counter}`;
  return `layer_${counter}_${rand.slice(0, 8)}`;
}

const baseDefaults = (name: string): Omit<LayerBase, 'kind'> => ({
  id: newLayerId(),
  name,
  visible: true,
  opacity: 1,
  blendMode: 'normal',
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  pivotX: 0,
  pivotY: 0,
  locked: false,
  mask: null,
});

export function createRasterLayer(width: number, height: number, name = 'Ebene'): RasterLayer {
  const { canvas } = createCanvas(width, height);
  return { ...baseDefaults(name), kind: 'raster', canvas };
}

export function createTextLayer(style: TextStyle, name = 'Text'): TextLayer {
  return { ...baseDefaults(name), kind: 'text', style };
}

export function createShapeLayer(style: ShapeStyle, name = 'Form'): ShapeLayer {
  return { ...baseDefaults(name), kind: 'shape', style };
}
