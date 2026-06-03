import type { ToolId } from '../types';
import type { Tool, ToolContext, PointerInfo } from './Tool';
import { createTextLayer } from '../doc/Layer';
import { makeCommand } from '../history/commands';

/** Click to place a text layer; opens inline editing immediately. */
export class TextTool implements Tool {
  id: ToolId = 'text';

  cursor(): string {
    return 'text';
  }

  onPointerDown(e: PointerInfo, ctx: ToolContext): void {
    const style = { ...ctx.options.textDefaults, color: { ...ctx.foreground } };
    const layer = createTextLayer(style, 'Text');
    layer.offsetX = e.doc.x;
    layer.offsetY = e.doc.y;

    const doc = ctx.doc;
    const at = doc.activeLayerId ? doc.indexOf(doc.activeLayerId) + 1 : doc.layers.length;
    ctx.history.push(
      makeCommand(
        'Text hinzufügen',
        () => {
          doc.layers.splice(at, 0, layer);
          doc.activeLayerId = layer.id;
          ctx.layersChanged();
        },
        () => {
          doc.removeLayer(layer.id);
          ctx.layersChanged();
        },
      ),
    );
    doc.layers.splice(at, 0, layer);
    doc.activeLayerId = layer.id;
    ctx.layersChanged();
    ctx.requestRender();
    ctx.beginTextEdit?.(layer.id);
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}
