// Core engine types. Framework-agnostic — no React/DOM-framework imports so the
// engine stays unit-testable and reusable. (DOM canvas types are fine.)

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 8-bit RGBA color, each channel 0..255. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Blend modes we support. The values double as a lookup into the canvas
 * `globalCompositeOperation` table in BlendMode.ts and map to PSD blend keys.
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type LayerKind = 'raster' | 'text' | 'shape';

export type ToolId =
  | 'move'
  | 'brush'
  | 'eraser'
  | 'marquee'
  | 'lasso'
  | 'wand'
  | 'fill'
  | 'shape'
  | 'text'
  | 'crop'
  | 'eyedropper'
  | 'hand'
  | 'zoom';

export type ShapeKind = 'rectangle' | 'ellipse' | 'line';

export interface TextStyle {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: RGBA;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  /** Background plate color (e.g. for lower-thirds); null = none. */
  background: RGBA | null;
  /** Padding around the text when a background plate is drawn, in px. */
  padding: number;
}

export interface ShapeStyle {
  shape: ShapeKind;
  fill: RGBA | null;
  stroke: RGBA | null;
  strokeWidth: number;
  /** Shape bounds in layer-local coordinates (before the layer offset). */
  bounds: Rect;
}

/** Brush/eraser settings shared across paint tools. */
export interface BrushSettings {
  size: number;
  /** 0..1 — soft edge falloff. 1 = hard. */
  hardness: number;
  /** 0..1 — per-stamp opacity. */
  opacity: number;
}
