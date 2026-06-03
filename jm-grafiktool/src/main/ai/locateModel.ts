import { app } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Resolve a bundled AI model path. In a packaged app models live under
 * `process.resourcesPath/models`; in dev they live under `resources/models`.
 * Mirrors the binary-resolution pattern used for ffmpeg in the sibling app.
 */
export function modelPath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'models', filename);
  }
  return path.join(app.getAppPath(), 'resources', 'models', filename);
}

export function modelExists(filename: string): boolean {
  return existsSync(modelPath(filename));
}
