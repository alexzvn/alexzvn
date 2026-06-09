import type { EditorController } from '@/engine/render/EditorController';
import { renderLayerLocal } from '@/engine/io/layerRender';
import { createCanvas } from '@/engine/canvas';

const INPUT_SIZE = 320; // u2netp input resolution

/**
 * Run local AI background removal ("Magic Mask") on a layer and apply the
 * result as the layer's alpha mask (non-destructive). The layer is rendered to
 * the model's square input, segmented in the main process, and the returned
 * matte is scaled back to document size as a mask.
 */
export async function freistellen(controller: EditorController, layerId: string): Promise<void> {
  if (!window.jmg?.ai) throw new Error('KI ist nur in der Desktop-App verfügbar.');
  const layer = controller.doc.layerById(layerId);
  if (!layer) return;
  const w = controller.doc.width;
  const h = controller.doc.height;

  // Segment the layer's LOCAL (untransformed) content so the mask lives in the
  // same space as the pixels and transforms together with the layer.
  const full = renderLayerLocal(layer, w, h);
  const small = createCanvas(INPUT_SIZE, INPUT_SIZE);
  small.ctx.drawImage(full, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const rgba = new Uint8Array(small.ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data);

  const { matte, size } = await window.jmg.ai.segment({ rgba, size: INPUT_SIZE });

  // Build a small mask canvas (alpha = matte), then scale up to document size.
  const maskSmall = createCanvas(size, size);
  const img = maskSmall.ctx.createImageData(size, size);
  for (let i = 0; i < matte.length; i++) img.data[i * 4 + 3] = matte[i];
  maskSmall.ctx.putImageData(img, 0, 0);

  const mask = createCanvas(w, h);
  mask.ctx.imageSmoothingEnabled = true;
  mask.ctx.drawImage(maskSmall.canvas, 0, 0, w, h);

  controller.setLayerMask(layerId, mask.canvas);
}
