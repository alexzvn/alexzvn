// Shared domain + IPC types for JM Presenter.
// Used by the main process, the preload bridge and the renderer.

export type ViewName = 'editor' | 'presenter' | 'audience';

export type SourceKind = 'pdf' | 'image';

/** A document imported into the project (a multi-page PDF or a single image). */
export interface SourceMeta {
  id: string;
  kind: SourceKind;
  name: string; // original file name, for display
  pageCount: number; // pdf: number of pages, image: always 1
}

export type OverlayKind = 'text' | 'image';

/**
 * An overlay placed on top of a slide. All geometry is normalised to the slide
 * box (0..1) so it renders identically at any resolution (editor, audience, export).
 */
export interface Overlay {
  id: string;
  kind: OverlayKind;
  x: number; // 0..1 — left
  y: number; // 0..1 — top
  w: number; // 0..1 — width
  h: number; // 0..1 — height
  rotation: number; // degrees
  // text overlays
  text?: string;
  fontFrac?: number; // font size as fraction of slide height (e.g. 0.06)
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string | null; // optional box background (e.g. lower-third bar)
  // image overlays
  imageId?: string; // key into the project's image asset map
}

/** A single slide = one source page plus optional overlays + presenter metadata. */
export interface Slide {
  id: string;
  sourceId: string;
  pageIndex: number; // 0-based page within the source
  title: string;
  notes: string;
  hidden: boolean;
  overlays: Overlay[];
}

/** The editable project document (serialised into a .jmpres ZIP). */
export interface ProjectDoc {
  schemaVersion: number;
  name: string;
  slides: Slide[];
  sources: SourceMeta[];
}

/** Runtime presentation state — owned by the main process, broadcast to windows. */
export interface PresentationState {
  active: boolean;
  index: number; // index into the visible-slide list
  total: number; // number of visible slides
  blackout: boolean; // reserved for v0.2 (black/white screen)
}

/**
 * Everything the presenter/audience windows need to render, handed over when a
 * presentation starts. Source bytes travel as transferable Uint8Arrays.
 */
export interface PresentationPayload {
  slides: Slide[]; // visible slides, in presentation order
  sources: Record<string, { kind: SourceKind; bytes: Uint8Array }>;
  images: Record<string, Uint8Array>; // overlay image assets by id
  startIndex: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
  current: boolean; // is the audience window currently on this display?
}

/** A file picked/imported through the main process, delivered to the renderer. */
export interface ImportedFile {
  name: string;
  kind: SourceKind;
  bytes: Uint8Array;
}

export interface OfficeImportResult {
  ok: boolean;
  name?: string;
  bytes?: Uint8Array; // converted PDF bytes
  error?: string;
}

/** The window API exposed on `window.jmpr`. */
export interface JmprApi {
  platform: NodeJS.Platform;
  /** Which view this window renders, parsed from the launch URL. */
  view: ViewName;

  files: {
    /** Open PDFs/images and return their bytes. */
    importDocs: () => Promise<ImportedFile[]>;
    /** Open an image to use as an overlay (logo). */
    importImage: () => Promise<ImportedFile | null>;
    /** Convert an Office document (PPTX/DOCX/…) to PDF via LibreOffice. */
    importOffice: () => Promise<OfficeImportResult>;
    /** Open a .jmpres project; returns the raw zip bytes. */
    openProject: () => Promise<{ name: string; bytes: Uint8Array } | null>;
    /** Save .jmpres project bytes to disk (save dialog). */
    saveProject: (suggestedName: string, bytes: Uint8Array) => Promise<string | null>;
    /** Save exported PDF bytes to disk (save dialog). */
    savePdf: (suggestedName: string, bytes: Uint8Array) => Promise<string | null>;
  };

  present: {
    /** Hand the payload to the main process and open presenter + audience windows. */
    start: (payload: PresentationPayload, audienceDisplayId: number | null) => Promise<void>;
    /** Fetch the active payload (presenter/audience windows call this on load). */
    getPayload: () => Promise<PresentationPayload | null>;
    getState: () => Promise<PresentationState>;
    goto: (index: number) => Promise<void>;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    stop: () => Promise<void>;
    /** List displays + which one holds the audience window. */
    displays: () => Promise<DisplayInfo[]>;
    /** Move the audience window to a given display (fullscreen). */
    assignAudience: (displayId: number) => Promise<void>;
    toggleAudienceFullscreen: () => Promise<boolean>;
    onState: (cb: (s: PresentationState) => void) => () => void;
  };
}
