import { useEffect, useState } from 'react';
import { Card } from '@jm/ui';
import { Button } from '@jm/ui';
import { ProgressBar } from '@/components/ProgressBar';
import type { VerifyProgress, VerifyReport } from '@shared/types';
import { cn } from '@jm/ui';

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

export function VerifyView() {
  const [dir, setDir] = useState<string | null>(null);
  const [mhls, setMhls] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<VerifyProgress | null>(null);
  const [report, setReport] = useState<VerifyReport | null>(null);

  useEffect(() => {
    return window.jmcp.onVerifyProgress((p) => setProgress(p));
  }, []);

  const pickFolder = async () => {
    const chosen = await window.jmcp.dialog.pickDir('Ordner mit MHL-Protokoll wählen');
    if (!chosen) return;
    setDir(chosen);
    setReport(null);
    const found = await window.jmcp.verify.findMhl(chosen);
    setMhls(found);
    setSelected(found[0] ?? '');
  };

  const run = async () => {
    if (!selected) return;
    setRunning(true);
    setReport(null);
    setProgress(null);
    try {
      setReport(await window.jmcp.verify.run(selected));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <Card>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={pickFolder} disabled={running}>
              Ordner wählen…
            </Button>
            {dir && <code className="text-xs truncate">{dir}</code>}
          </div>

          {dir && mhls.length === 0 && (
            <p className="text-sm text-[var(--destructive)]">
              Keine .mhl-Datei in diesem Ordner gefunden.
            </p>
          )}

          {mhls.length > 0 && (
            <div className="flex items-end gap-3">
              <label className="flex-1 block">
                <span className="block text-[11px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)] mb-1.5">
                  MHL-Protokoll
                </span>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="h-10 w-full rounded-[var(--radius)] px-3 text-sm font-semibold
                             bg-[var(--input)] border border-[var(--border)]"
                >
                  {mhls.map((m) => (
                    <option key={m} value={m}>
                      {baseName(m)}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={run} disabled={running || !selected}>
                Prüfen
              </Button>
            </div>
          )}

          {running && progress && (
            <div className="space-y-2">
              <ProgressBar value={progress.total ? progress.done / progress.total : 0} />
              <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                <span className="truncate">{progress.currentRelPath}</span>
                <span className="tabular">
                  {progress.done}/{progress.total}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {report && (
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <span
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold',
                  report.mismatch === 0 && report.missing === 0
                    ? 'bg-[var(--highlight)] text-[var(--primary)]'
                    : 'bg-[var(--destructive)]/15 text-[var(--destructive)]',
                )}
              >
                {report.mismatch === 0 && report.missing === 0 ? '✓' : '!'}
              </span>
              <div>
                <div className="font-extrabold">
                  {report.mismatch === 0 && report.missing === 0
                    ? 'Alle Dateien unverändert'
                    : 'Abweichungen gefunden'}
                </div>
                <div className="text-sm text-[var(--muted-foreground)] tabular">
                  {report.ok} ok · {report.mismatch} abweichend · {report.missing} fehlend ·{' '}
                  {report.total} gesamt
                </div>
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto scroll-thin divide-y divide-[var(--border)]/40">
              {report.files
                .filter((f) => f.status !== 'ok')
                .concat(report.files.filter((f) => f.status === 'ok'))
                .map((f) => (
                  <div key={f.relPath} className="flex items-center gap-3 px-2 py-1.5">
                    <span
                      className={cn(
                        'w-4 text-center font-bold',
                        f.status === 'ok'
                          ? 'text-[var(--primary)]'
                          : 'text-[var(--destructive)]',
                      )}
                    >
                      {f.status === 'ok' ? '✓' : f.status === 'missing' ? '∅' : '✗'}
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">{f.relPath}</span>
                    <span className="w-28 text-right text-xs font-semibold text-[var(--muted-foreground)]">
                      {f.status === 'ok'
                        ? 'unverändert'
                        : f.status === 'missing'
                          ? 'fehlt'
                          : 'verändert'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
