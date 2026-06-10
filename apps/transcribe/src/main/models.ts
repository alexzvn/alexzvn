import { app, net } from 'electron';
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { MODELS, type ModelState, type WhisperModelId } from '@shared/types';
import { bundledModelsDir } from './locate';

const HF_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

function userModelsDir(): string {
  const dir = join(app.getPath('userData'), 'models');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fileName(id: WhisperModelId): string {
  return `ggml-${id}.bin`;
}

// Laufende Downloads (0..1).
const downloading = new Map<WhisperModelId, number>();

/** Installierter Modellpfad (User-Ordner bevorzugt, base auch gebündelt) oder null. */
export function modelPathFor(id: WhisperModelId): string | null {
  const userPath = join(userModelsDir(), fileName(id));
  if (existsSync(userPath)) return userPath;
  if (id === 'base') {
    const bundled = join(bundledModelsDir(), fileName('base'));
    if (existsSync(bundled)) return bundled;
  }
  return null;
}

export function modelStates(): ModelState[] {
  return MODELS.map((m) => ({
    ...m,
    installed: modelPathFor(m.id) != null,
    downloading: downloading.has(m.id) ? (downloading.get(m.id) as number) : null,
  }));
}

/** Modell von Hugging Face nach userData/models laden. `onProgress` 0..1. */
export async function downloadModel(
  id: WhisperModelId,
  onProgress: () => void,
): Promise<void> {
  if (downloading.has(id)) return;
  if (modelPathFor(id) && id !== 'base') return; // schon da (außer base: erlauben, falls größer gewünscht)

  const url = `${HF_BASE}/${fileName(id)}`;
  const dest = join(userModelsDir(), fileName(id));
  const tmp = `${dest}.part`;

  downloading.set(id, 0);
  onProgress();

  await new Promise<void>((resolve, reject) => {
    const request = net.request(url);
    request.on('response', (response) => {
      if (response.statusCode >= 400) {
        downloading.delete(id);
        reject(new Error(`Download fehlgeschlagen (HTTP ${response.statusCode})`));
        return;
      }
      const total = Number(response.headers['content-length'] || 0);
      let received = 0;
      const out = createWriteStream(tmp);
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        out.write(chunk);
        if (total > 0) {
          downloading.set(id, received / total);
          onProgress();
        }
      });
      response.on('end', () => {
        out.end(() => {
          try {
            renameSync(tmp, dest);
            downloading.delete(id);
            onProgress();
            resolve();
          } catch (err) {
            downloading.delete(id);
            reject(err as Error);
          }
        });
      });
      response.on('error', (err: Error) => {
        out.destroy();
        downloading.delete(id);
        try {
          rmSync(tmp, { force: true });
        } catch {
          /* ignore */
        }
        reject(err);
      });
    });
    request.on('error', (err) => {
      downloading.delete(id);
      reject(err);
    });
    request.end();
  });
}

/** Heruntergeladenes Modell löschen (gebündeltes base bleibt erhalten). */
export function deleteModel(id: WhisperModelId): void {
  const userPath = join(userModelsDir(), fileName(id));
  if (existsSync(userPath)) {
    try {
      // Nur löschen, wenn es wirklich eine Datei ist.
      if (statSync(userPath).isFile()) rmSync(userPath, { force: true });
    } catch {
      /* ignore */
    }
  }
}
