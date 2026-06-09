import { create } from 'zustand';
import type { ControllerState, EditorController } from '@/engine/render/EditorController';

const EMPTY: ControllerState = {
  layers: [],
  activeLayerId: null,
  toolId: 'brush',
  foreground: '#000000',
  background: '#ffffff',
  brush: { size: 24, hardness: 0.85, opacity: 1 },
  options: {
    shapeKind: 'rectangle',
    shapeFill: true,
    shapeStroke: false,
    shapeStrokeWidth: 4,
    tolerance: 32,
    contiguous: true,
    textDefaults: {
      text: 'Text',
      fontFamily: '"Manrope Variable", system-ui, sans-serif',
      fontSize: 72,
      fontWeight: 800,
      color: { r: 0, g: 0, b: 0, a: 255 },
      align: 'left',
      lineHeight: 1.2,
      background: null,
      padding: 16,
    },
  },
  zoom: 1,
  hasSelection: false,
  canUndo: false,
  canRedo: false,
  docWidth: 1920,
  docHeight: 1080,
  showSafeArea: false,
};

interface EditorStore extends ControllerState {
  /** The live engine controller. UI metadata above is a read-only mirror. */
  controller: EditorController | null;
  attach: (c: EditorController) => void;
  detach: () => void;
  /** Pull the latest snapshot from the controller into the store. */
  sync: () => void;
}

export const useEditor = create<EditorStore>((set, get) => ({
  ...EMPTY,
  controller: null,
  attach: (c) => {
    set({ controller: c, ...c.getState() });
  },
  detach: () => set({ controller: null, ...EMPTY }),
  sync: () => {
    const c = get().controller;
    if (c) set(c.getState());
  },
}));

/** The active layer summary, or null. */
export function useActiveLayer() {
  return useEditor((s) => s.layers.find((l) => l.isActive) ?? null);
}
