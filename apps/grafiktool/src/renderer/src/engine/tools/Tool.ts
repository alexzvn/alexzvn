import type { BrushSettings, Point, RGBA, ShapeKind, TextStyle, ToolId } from '../types';
import type { Document } from '../doc/Document';
import type { RasterLayer } from '../doc/Layer';
import type { Viewport } from '../viewport/Viewport';
import type { History } from '../history/History';
import type { Selection } from '../selection/Selection';
import type { OverlayRenderer } from '../render/OverlayRenderer';

/** Tool-specific options surfaced in the options bar / properties panel. */
export interface ToolOptions {
  shapeKind: ShapeKind;
  shapeFill: boolean;
  shapeStroke: boolean;
  shapeStrokeWidth: number;
  /** Magic wand / fill bucket color tolerance, 0..255. */
  tolerance: number;
  /** Whether wand/fill operate on the connected region only. */
  contiguous: boolean;
  /** Default style applied to newly created text layers. */
  textDefaults: TextStyle;
}

export interface PointerInfo {
  /** Pointer position in document coordinates. */
  doc: Point;
  /** Pointer position in screen (viewport element) coordinates. */
  screen: Point;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  button: number;
  pressure: number;
}

/**
 * Services the active tool may use. The EditorController implements this and
 * passes it to every pointer callback, so tools never reach into React.
 */
export interface ToolContext {
  doc: Document;
  viewport: Viewport;
  history: History;
  foreground: RGBA;
  background: RGBA;
  brush: BrushSettings;
  options: ToolOptions;

  /** Schedule a viewport repaint. */
  requestRender(): void;
  /** Notify that the layer stack / metadata changed (mirrors into the store). */
  layersChanged(): void;
  /** Replace the current selection (null clears it). */
  setSelection(sel: Selection | null): void;
  /** Update the foreground color (e.g. from the eyedropper). */
  setForeground(c: RGBA): void;
  /** Provisional overlay drawing during a drag (cleared with null). */
  setPreview(draw: ((o: OverlayRenderer) => void) | null): void;
  /** Read the flattened pixel under a document point (for the eyedropper). */
  sampleComposite(x: number, y: number): RGBA;
  /** The flattened document as ImageData (for the magic wand). */
  compositeImageData(): ImageData;
  /**
   * Return a paintable raster layer: the active layer if it is an unlocked
   * raster, otherwise create a new raster layer above it (recorded in history).
   * Used by paint/fill tools so painting "just works" even when a text/shape
   * layer is active.
   */
  ensureRasterLayer(): RasterLayer;
  /** Switch the active tool programmatically. */
  activateTool(id: ToolId): void;
  /** Begin in-canvas text editing for a text layer. */
  beginTextEdit?(layerId: string): void;
}

export interface Tool {
  id: ToolId;
  cursor?(ctx: ToolContext): string;
  onPointerDown(e: PointerInfo, ctx: ToolContext): void;
  onPointerMove(e: PointerInfo, ctx: ToolContext): void;
  onPointerUp(e: PointerInfo, ctx: ToolContext): void;
  onPointerLeave?(e: PointerInfo, ctx: ToolContext): void;
  /** Persistent overlay (handles, guides) drawn every frame while active. */
  drawOverlay?(o: OverlayRenderer, ctx: ToolContext): void;
}
