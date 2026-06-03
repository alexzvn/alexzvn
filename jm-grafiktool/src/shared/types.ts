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
  };
  shell: {
    reveal: (path: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
}
