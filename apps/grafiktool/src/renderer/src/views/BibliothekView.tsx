import { useCallback, useEffect, useState } from 'react';
import type { LibraryItem } from '@shared/types';
import { useEditor } from '@/store/editor';
import { Button } from '@jm/ui';
import { Card } from '@jm/ui';
import { TEMPLATES } from '@/components/editor/templates';
import { encodeCanvas } from '@/engine/io/exportRaster';
import { decodeToBitmap } from '@/engine/io/importImage';
import { createCanvas } from '@/engine/canvas';
import { Icon } from '@/components/editor/Icons';

function makeThumb(src: HTMLCanvasElement, max = 240): HTMLCanvasElement {
  const scale = Math.min(max / src.width, max / src.height, 1);
  const { canvas, ctx } = createCanvas(Math.round(src.width * scale), Math.round(src.height * scale));
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function BibliothekView({ onInserted }: { onInserted?: () => void }) {
  const controller = useEditor((s) => s.controller);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const available = !!window.jmg?.library;

  const refresh = useCallback(async () => {
    if (!available) return;
    setItems(await window.jmg.library.list());
  }, [available]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const insertTemplate = (id: string) => {
    if (!controller) return;
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    for (const layer of tpl.build(controller.doc.width, controller.doc.height)) controller.addLayer(layer);
    onInserted?.();
  };

  const saveCurrent = async () => {
    if (!controller || !available) return;
    setBusy(true);
    try {
      const flat = controller.flattenForExport();
      const png = await encodeCanvas(flat, 'png');
      const thumb = await encodeCanvas(makeThumb(flat), 'png');
      await window.jmg.library.add({
        name: `Grafik ${new Date().toLocaleString('de-DE')}`,
        pngBytes: png,
        thumbBytes: thumb,
        width: flat.width,
        height: flat.height,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const insertItem = async (item: LibraryItem) => {
    if (!controller || !available) return;
    const bytes = await window.jmg.library.read(item.id);
    if (!bytes) return;
    const bmp = await decodeToBitmap(bytes);
    controller.addImageLayer(bmp, item.name);
    bmp.close();
    onInserted?.();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[1100px] mx-auto px-7 py-6 flex flex-col gap-6">
        {/* Templates */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
            Bauchbinden-Vorlagen
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TEMPLATES.map((t) => (
              <Card key={t.id} variant="nested" className="p-4 flex flex-col gap-3">
                <div className="h-20 rounded-[var(--radius)] bg-[#1d1d1d] relative overflow-hidden">
                  <div className="absolute left-2 right-10 bottom-2 h-6 rounded-sm bg-[var(--card)] border-l-2 border-[var(--primary)]" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold truncate">{t.label}</span>
                  <Button size="sm" variant="outline" uppercase={false} onClick={() => insertTemplate(t.id)}>
                    Einfügen
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Saved graphics */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
              Meine Grafiken
            </h2>
            <Button size="sm" variant="primary" uppercase={false} onClick={saveCurrent} disabled={!available || busy}>
              Aktuelle Grafik speichern
            </Button>
          </div>

          {!available && (
            <Card className="p-6 text-sm text-[var(--muted-foreground)]">
              Die lokale Bibliothek ist nur in der Desktop-App verfügbar.
            </Card>
          )}

          {available && items.length === 0 && (
            <Card className="p-6 text-sm text-[var(--muted-foreground)]">
              Noch keine Grafiken gespeichert. Erstelle etwas im Editor und klicke „Aktuelle Grafik speichern".
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <Card key={item.id} variant="nested" className="p-2 flex flex-col gap-2 group">
                <button
                  type="button"
                  onClick={() => insertItem(item)}
                  title="In den Editor einfügen"
                  className="aspect-video rounded-[var(--radius)] overflow-hidden jmg-checker grid place-items-center"
                >
                  <img src={item.thumbDataUrl} alt={item.name} className="max-w-full max-h-full object-contain" />
                </button>
                <div className="flex items-center justify-between gap-1 px-1">
                  <span className="text-[11px] truncate" title={item.name}>
                    {item.name}
                  </span>
                  <button
                    type="button"
                    title="Löschen"
                    onClick={async () => {
                      await window.jmg.library.remove(item.id);
                      await refresh();
                    }}
                    className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--destructive)] opacity-0 group-hover:opacity-100"
                  >
                    <Icon.trash size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
