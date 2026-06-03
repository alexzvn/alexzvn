// Shared types for JM Grafiktool — used by the main process, the preload bridge
// (window.jmg) and the renderer. Kept dependency-free so it compiles in both the
// Node (main/preload) and DOM (renderer) tsconfig projects.

export type ImageFormat = 'png' | 'jpg' | 'webp';

/** A file the user picked, returned with the bytes already read in the main process. */
export interface PickedImage {
  path: string;
  fileName: string;
  /** Raw file bytes; the renderer decodes these into an ImageBitmap. */
  bytes: Uint8Array;
}

export interface SaveImageRequest {
  /** Suggested base file name without extension. */
  suggestedName: string;
  format: ImageFormat;
  /** Encoded image bytes produced by the renderer (canvas.toBlob). */
  bytes: Uint8Array;
}

export interface SaveImageResult {
  saved: boolean;
  path?: string;
}

export interface OpenedFile {
  path: string;
  fileName: string;
  bytes: Uint8Array;
}

/** Which file types the open dialog should offer. */
export type OpenKind = 'all' | 'project';

export interface SaveBytesRequest {
  suggestedName: string;
  /** File extension without the dot, e.g. 'psd' | 'jmg'. */
  ext: string;
  /** Human label for the dialog filter, e.g. 'Photoshop'. */
  filterName: string;
  bytes: Uint8Array;
}

/** Shape exposed on `window.jmg` by the preload bridge. */
export interface JmgApi {
  platform: NodeJS.Platform;
  /** Resolve the absolute path of a dropped File (Electron webUtils). */
  pathForFile: (file: File) => string;
  dialog: {
    /** Open one or more raster images; bytes are read in the main process. */
    pickImages: () => Promise<PickedImage[]>;
  };
  file: {
    /** Read an arbitrary file path (e.g. a dropped image) into bytes. */
    read: (path: string) => Promise<PickedImage>;
    /** Show a save dialog and write the encoded image to disk. */
    saveImage: (req: SaveImageRequest) => Promise<SaveImageResult>;
    /** Open one file (images, PSD, SVG, TIFF or .jmg projects) as raw bytes. */
    open: (kind: OpenKind) => Promise<OpenedFile | null>;
    /** Show a save dialog and write arbitrary bytes (PSD, .jmg) to disk. */
    saveBytes: (req: SaveBytesRequest) => Promise<SaveImageResult>;
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
}
