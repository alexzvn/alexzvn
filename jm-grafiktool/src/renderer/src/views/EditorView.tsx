import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { PickedImage } from '@shared/types';

const DOC_W = 1920;
const DOC_H = 1080;

/**
 * Phase 0 editor scaffold: establishes the three-column editor layout (tool
 * dock · canvas viewport · panels) and proves the full pipeline — import an
 * image via IPC, draw it onto a 1920×1080 document canvas, export PNG with
 * alpha. The real layer engine and tools replace the canvas internals in Phase 1.
 */
export function EditorView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [busy, setBusy] = useState(false);

  const clear = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, DOC_W, DOC_H);
  }, []);

  useEffect(() => {
    clear();
  }, [clear]);

  const drawImage = useCallback(async (picked: PickedImage) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const blob = new Blob([picked.bytes as BlobPart]);
    const bitmap = await createImageBitmap(blob);
    // Fit the image into the document, centered, preserving aspect ratio.
    const scale = Math.min(DOC_W / bitmap.width, DOC_H / bitmap.height, 1);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.clearRect(0, 0, DOC_W, DOC_H);
    ctx.drawImage(bitmap, (DOC_W - w) / 2, (DOC_H - h) / 2, w, h);
    bitmap.close();
    setHasContent(true);
  }, []);

  const onImport = useCallback(async () => {
    setBusy(true);
    try {
      const picked = await window.jmg.dialog.pickImages();
      if (picked[0]) await drawImage(picked[0]);
    } finally {
      setBusy(false);
    }
  }, [drawImage]);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      setBusy(true);
      try {
        const path = window.jmg.pathForFile(file);
        const picked = path
          ? await window.jmg.file.read(path)
          : { path: file.name, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
        await drawImage(picked);
      } finally {
        setBusy(false);
      }
    },
    [drawImage],
  );

  const onExport = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await window.jmg.file.saveImage({ suggestedName: 'grafik', format: 'png', bytes });
  }, []);

  return (
    <div className="h-full flex">
      {/* Left tool dock (placeholder — real tools arrive in Phase 1). */}
      <aside className="w-14 shrink-0 border-r border-[var(--border)]/60 bg-[var(--sidebar)] flex flex-col items-center gap-1 py-3">
        {['Move', 'Pinsel', 'Radierer', 'Auswahl', 'Füllen', 'Text', 'Pipette'].map((t) => (
          <button
            key={t}
            title={t}
            disabled
            className="w-9 h-9 rounded-[var(--radius)] grid place-items-center text-[10px] font-bold
                       text-[var(--muted-foreground)] hover:bg-[var(--highlight)] disabled:opacity-40"
          >
            {t.slice(0, 2)}
          </button>
        ))}
      </aside>

      {/* Center viewport. */}
      <div
        className="flex-1 min-w-0 grid place-items-center overflow-auto p-8 jmg-checker"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="relative shadow-2xl ring-1 ring-black/40">
          <canvas
            ref={canvasRef}
            width={DOC_W}
            height={DOC_H}
            className="block max-w-full max-h-[calc(100vh-12rem)] bg-transparent"
            style={{ aspectRatio: `${DOC_W} / ${DOC_H}` }}
          />
          {!hasContent && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm font-bold text-[var(--foreground)]/80">Leere Arbeitsfläche · {DOC_W}×{DOC_H}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Bild importieren oder hierher ziehen
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panels. */}
      <aside className="w-72 shrink-0 border-l border-[var(--border)]/60 bg-[var(--card)]/40 flex flex-col">
        <div className="p-4 border-b border-[var(--border)]/50 flex flex-col gap-2">
          <Button size="sm" variant="primary" onClick={onImport} disabled={busy} className="w-full">
            Importieren
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onExport} disabled={!hasContent} className="flex-1">
              PNG Export
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { clear(); setHasContent(false); }} disabled={!hasContent}>
              Leeren
            </Button>
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--muted-foreground)]">
            Ebenen
          </h3>
          <div className={cn('mt-2 text-xs text-[var(--muted-foreground)]')}>
            Das Ebenen-Panel folgt in Phase 1 (Engine).
          </div>
        </div>
      </aside>
    </div>
  );
}
