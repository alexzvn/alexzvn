import type { Layer } from '@/engine/doc/Layer';
import { createShapeLayer, createTextLayer } from '@/engine/doc/Layer';
import type { RGBA } from '@/engine/types';

const DARK: RGBA = { r: 24, g: 24, b: 24, a: 235 };
const YELLOW: RGBA = { r: 251, g: 231, b: 59, a: 255 };
const WHITE: RGBA = { r: 245, g: 245, b: 245, a: 255 };

function bar(x: number, y: number, w: number, h: number, fill: RGBA, name: string): Layer {
  const layer = createShapeLayer(
    { shape: 'rectangle', fill, stroke: null, strokeWidth: 0, bounds: { x: 0, y: 0, width: w, height: h } },
    name,
  );
  layer.offsetX = x;
  layer.offsetY = y;
  return layer;
}

function text(
  x: number,
  y: number,
  content: string,
  size: number,
  color: RGBA,
  weight: number,
  name: string,
): Layer {
  const layer = createTextLayer(
    {
      text: content,
      fontFamily: '"Manrope Variable", system-ui, sans-serif',
      fontSize: size,
      fontWeight: weight,
      color,
      align: 'left',
      lineHeight: 1.15,
      background: null,
      padding: 0,
    },
    name,
  );
  layer.offsetX = x;
  layer.offsetY = y;
  return layer;
}

export interface Template {
  id: string;
  label: string;
  /** Build the layers (returned bottom-to-top) for a document of this size. */
  build: (w: number, h: number) => Layer[];
}

/** Lower-third ("Bauchbinde") presets, scaled to the document height. */
export const TEMPLATES: Template[] = [
  {
    id: 'classic',
    label: 'Bauchbinde Klassik',
    build: (w, h) => {
      const barH = Math.round(h * 0.17);
      const top = Math.round(h * 0.72);
      const pad = Math.round(w * 0.045);
      return [
        bar(0, top, Math.round(w * 0.62), barH, DARK, 'Balken'),
        bar(0, top, Math.round(w * 0.008), barH, YELLOW, 'Akzent'),
        text(pad, top + Math.round(barH * 0.22), 'Vorname Nachname', Math.round(barH * 0.34), WHITE, 800, 'Titel'),
        text(pad, top + Math.round(barH * 0.62), 'Funktion · Ort', Math.round(barH * 0.2), YELLOW, 600, 'Untertitel'),
      ];
    },
  },
  {
    id: 'yellow',
    label: 'Bauchbinde Gelb',
    build: (w, h) => {
      const barH = Math.round(h * 0.15);
      const top = Math.round(h * 0.74);
      const pad = Math.round(w * 0.045);
      return [
        bar(0, top, Math.round(w * 0.55), barH, YELLOW, 'Balken'),
        text(pad, top + Math.round(barH * 0.24), 'THEMA / TITEL', Math.round(barH * 0.38), DARK, 800, 'Titel'),
        text(pad, top + Math.round(barH * 0.66), 'Untertitel hier', Math.round(barH * 0.22), DARK, 600, 'Untertitel'),
      ];
    },
  },
  {
    id: 'banner',
    label: 'Unterer Banner',
    build: (w, h) => {
      const barH = Math.round(h * 0.1);
      const top = h - barH;
      const pad = Math.round(w * 0.04);
      return [
        bar(0, top, w, barH, DARK, 'Banner'),
        bar(0, top, w, Math.round(h * 0.006), YELLOW, 'Linie'),
        text(pad, top + Math.round(barH * 0.28), 'Lauftext / Hinweis', Math.round(barH * 0.42), WHITE, 700, 'Text'),
      ];
    },
  },
];
