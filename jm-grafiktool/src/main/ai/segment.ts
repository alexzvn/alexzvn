// CPU image segmentation via onnxruntime-node (U2-Net family). Kept free of
// Electron imports so it can be unit-tested in plain Node. onnxruntime is loaded
// lazily so the native addon isn't touched until the first segmentation.

type OrtModule = typeof import('onnxruntime-node');
type Session = import('onnxruntime-node').InferenceSession;

let ortPromise: Promise<OrtModule> | null = null;
function ort(): Promise<OrtModule> {
  ortPromise ??= import('onnxruntime-node');
  return ortPromise;
}

/** ImageNet normalization used by U2-Net (rembg-compatible). */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export async function createSession(modelFsPath: string): Promise<Session> {
  const o = await ort();
  return o.InferenceSession.create(modelFsPath, { executionProviders: ['cpu'] });
}

/**
 * Run segmentation on a square RGBA buffer (`size`×`size`) and return an 8-bit
 * alpha matte (length size×size, 255 = foreground). The matte is min-max
 * normalized like rembg so the subject pops against the background.
 */
export async function runSegment(session: Session, rgba: Uint8Array, size: number): Promise<Uint8Array> {
  const o = await ort();
  const n = size * size;
  const data = new Float32Array(3 * n);

  // Scale by the actual max pixel value (rembg behavior), then standardize.
  let maxv = 1;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] > maxv) maxv = rgba[i];
    if (rgba[i + 1] > maxv) maxv = rgba[i + 1];
    if (rgba[i + 2] > maxv) maxv = rgba[i + 2];
  }
  for (let p = 0; p < n; p++) {
    const j = p * 4;
    data[p] = (rgba[j] / maxv - MEAN[0]) / STD[0];
    data[n + p] = (rgba[j + 1] / maxv - MEAN[1]) / STD[1];
    data[2 * n + p] = (rgba[j + 2] / maxv - MEAN[2]) / STD[2];
  }

  const tensor = new o.Tensor('float32', data, [1, 3, size, size]);
  const feeds: Record<string, typeof tensor> = { [session.inputNames[0]]: tensor };
  const results = await session.run(feeds);
  const out = results[session.outputNames[0]].data as Float32Array;

  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = out[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const range = mx - mn || 1;
  const matte = new Uint8Array(n);
  for (let i = 0; i < n; i++) matte[i] = Math.round(((out[i] - mn) / range) * 255);
  return matte;
}
