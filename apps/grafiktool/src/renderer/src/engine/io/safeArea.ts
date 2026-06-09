import type { Rect } from '../types';

/**
 * Broadcast title-safe (90%) and action-safe (93%) guides for the document,
 * centered — the zone where lower-thirds text must stay to survive overscan.
 */
export function safeAreaGuides(docW: number, docH: number): { rect: Rect; color: string }[] {
  const inset = (pct: number): Rect => {
    const mw = (docW * (1 - pct)) / 2;
    const mh = (docH * (1 - pct)) / 2;
    return { x: mw, y: mh, width: docW - mw * 2, height: docH - mh * 2 };
  };
  return [
    { rect: inset(0.93), color: 'rgba(255,229,74,0.35)' }, // action safe
    { rect: inset(0.9), color: 'rgba(255,229,74,0.6)' }, // title safe
  ];
}

/** Common broadcast/social document presets (px). */
export interface DocPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const DOC_PRESETS: DocPreset[] = [
  { id: 'fhd', label: 'Full HD 1920×1080', width: 1920, height: 1080 },
  { id: 'uhd', label: '4K UHD 3840×2160', width: 3840, height: 2160 },
  { id: 'sq', label: 'Quadrat 1080×1080', width: 1080, height: 1080 },
  { id: 'story', label: 'Story 1080×1920', width: 1080, height: 1920 },
  { id: 'lower', label: 'Bauchbinde 1920×400', width: 1920, height: 400 },
];
