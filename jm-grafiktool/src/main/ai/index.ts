import { ipcMain } from 'electron';
import type { AiSegmentRequest, AiSegmentResult, AiStatus } from '@shared/types';
import { modelExists, modelPath } from './locateModel';
import { createSession, runSegment } from './segment';

const MODEL_FILE = 'u2netp.onnx';
const MODEL_ID = 'u2netp';

// Lazily-created, cached inference session (built on first segmentation).
let sessionPromise: ReturnType<typeof createSession> | null = null;

/**
 * Register the AI/Magic-Mask IPC. Designed as a single provider for now
 * (U2-Net segmentation); a registry of providers (e.g. diffusion in Phase 4)
 * can slot in behind the same `ai:*` channels.
 */
export function registerAiIpc(): void {
  ipcMain.handle('ai:status', (): AiStatus => ({
    modelPresent: modelExists(MODEL_FILE),
    modelId: MODEL_ID,
  }));

  ipcMain.handle('ai:segment', async (_event, req: AiSegmentRequest): Promise<AiSegmentResult> => {
    if (!modelExists(MODEL_FILE)) {
      throw new Error('KI-Modell (u2netp.onnx) nicht gefunden.');
    }
    sessionPromise ??= createSession(modelPath(MODEL_FILE));
    const session = await sessionPromise;
    const matte = await runSegment(session, req.rgba, req.size);
    return { matte, size: req.size };
  });
}
