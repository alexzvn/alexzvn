import { useEffect, useState } from 'react';
import type { OfficeConvertSpec } from '@shared/types';
import { Button } from '@jm/ui';
import { Card } from '@jm/ui';
import { DropZone } from '@/components/DropZone';
import { useJobs } from '@/store/jobs';
import { basename } from '@/lib/format';

const LIBREOFFICE_URL = 'https://www.libreoffice.org/download/download-libreoffice/';

export function DocumentView() {
  const addJob = useJobs((s) => s.add);

  const [staged, setStaged] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  // undefined = still detecting, null = not installed, string = found
  const [soffice, setSoffice] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void window.jmc.office.detect().then((r) => setSoffice(r.path));
  }, []);

  function addFiles(paths: string[]): void {
    setStaged((prev) => Array.from(new Set([...prev, ...paths])));
  }

  async function pick(): Promise<void> {
    const paths = await window.jmc.dialog.pickFiles('office');
    if (paths.length) addFiles(paths);
  }

  async function pickOutput(): Promise<void> {
    const dir = await window.jmc.dialog.pickDir();
    if (dir) setOutputDir(dir);
  }

  function start(): void {
    if (!outputDir) return;
    for (const path of staged) {
      const jobId = crypto.randomUUID();
      const spec: OfficeConvertSpec = { jobId, inputPath: path, outputDir };
      addJob({
        id: jobId,
        kind: 'office',
        status: 'queued',
        inputPath: path,
        fileName: basename(path),
        presetLabel: '→ PDF',
        percent: -1,
      });
      void window.jmc.office.enqueue(spec);
    }
    setStaged([]);
  }

  const canConvert = Boolean(outputDir) && staged.length > 0 && soffice != null;

  return (
    <div className="space-y-6">
      {soffice === null && (
        <Card className="p-4 border-[var(--destructive)]/50">
          <p className="text-sm font-bold text-[var(--destructive)]">LibreOffice nicht gefunden</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Die Office→PDF-Umwandlung benötigt eine lokale LibreOffice-Installation.
          </p>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => window.jmc.shell.openExternal(LIBREOFFICE_URL)}>
              LibreOffice herunterladen
            </Button>
          </div>
        </Card>
      )}

      <DropZone
        hint="Office-Dokumente (docx, xlsx, pptx, odt …) hierher ziehen oder auswählen"
        onFiles={addFiles}
        onPick={pick}
      />

      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((path) => (
            <div
              key={path}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <p className="truncate text-sm font-bold">{basename(path)}</p>
              <button
                type="button"
                onClick={() => setStaged((prev) => prev.filter((p) => p !== path))}
                className="shrink-0 text-[11px] uppercase tracking-wide font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" onClick={pickOutput}>
              Zielordner
            </Button>
            <span className="truncate text-xs text-[var(--muted-foreground)]">
              {outputDir ?? 'Kein Zielordner gewählt'}
            </span>
          </div>
          <Button onClick={start} disabled={!canConvert}>
            In PDF umwandeln{staged.length > 0 ? ` (${staged.length})` : ''}
          </Button>
        </div>
        {soffice && (
          <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">LibreOffice erkannt: {soffice}</p>
        )}
      </Card>
    </div>
  );
}
