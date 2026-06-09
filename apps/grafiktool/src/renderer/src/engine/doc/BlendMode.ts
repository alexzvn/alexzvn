import type { BlendMode } from '../types';

/**
 * Map our blend modes to canvas `globalCompositeOperation` values. Canvas2D
 * implements the W3C compositing spec, which matches Photoshop for the common
 * separable modes (normal/multiply/screen/overlay/darken/lighten/dodge/burn/
 * hard-light/soft-light/difference/exclusion) and the non-separable HSL modes
 * (hue/saturation/color/luminosity). Low-opacity + HSL modes can diverge
 * slightly from Photoshop; documented as a known limitation in the plan.
 */
const GCO: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

export function blendToGCO(mode: BlendMode): GlobalCompositeOperation {
  return GCO[mode] ?? 'source-over';
}

export const BLEND_MODES: BlendMode[] = Object.keys(GCO) as BlendMode[];

export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  multiply: 'Multiplizieren',
  screen: 'Negativ multipl.',
  overlay: 'Ineinanderkopieren',
  darken: 'Abdunkeln',
  lighten: 'Aufhellen',
  'color-dodge': 'Farbig abwedeln',
  'color-burn': 'Farbig nachbelichten',
  'hard-light': 'Hartes Licht',
  'soft-light': 'Weiches Licht',
  difference: 'Differenz',
  exclusion: 'Ausschluss',
  hue: 'Farbton',
  saturation: 'Sättigung',
  color: 'Farbe',
  luminosity: 'Luminanz',
};
