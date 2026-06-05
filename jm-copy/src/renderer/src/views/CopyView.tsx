import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ProgressBar';
import { MasterFolderControls } from '@/components/MasterFolderControls';
import { useJob, type FileRow } from '@/store/job';
import { useTemplates, findTemplate } from '@/store/templates';
import { resolvePattern } from '@shared/template';
import type { CopySpec, Destination, FileStatus, ScanResult } from '@shared/types';
import { formatBytes, formatEta } from '@/lib/format';
import { cn } from '@/lib/cn';

interface DestRow {
  id: string;
  basePath: string;
}

const STATUS_META: Record<FileStatus, { icon: string; cls: string; label: string }> = {
  pending: { icon: '○', cls: 'text-[var(--muted-foreground)]', label: 'Wartet' },
  copying: { icon: '▸', cls: 'text-[var(--primary)]', label: 'Kopiert' },
  verifying: { icon: '◇', cls: 'text-[var(--primary)]', label: 'Prüft' },
  verified: { icon: '✓', cls: 'text-[var(--primary)]', label: 'Verifiziert' },
  mismatch: { icon: '✗', cls: 'text-[var(--destructive)]', label: 'Abweichung' },
  error: { icon: '!', cls: 'text-[var(--destructive)]', label: 'Fehler' },
  canceled: { icon: '–', cls: 'text-[var(--muted-foreground)]', label: 'Abgebrochen' },
};

export function CopyView() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dests, setDests] = useState<DestRow[]>([]);
  const [verify, setVerify] = useState(true);
  const [alsoMd5, setAlsoMd5] = useState(false);
  const [writeMhl, setWriteMhl] = useState(true);

  const job = useJob();
  const tState = useTemplates();
  const template = findTemplate(tState, tState.selectedId);

  const subPathPreview = useMemo(
    () => (template ? resolvePattern(template.pattern, tState.fields, new Date()) : ''),
    [template, tState.fields],
  );

  const pickSource = async () => {
    const paths = await window.jmcp.dialog.pickFiles();
    if (paths.length === 0) return;
    setScanning(true);
    try {
      setScan(await window.jmcp.scan.paths(paths));
    } finally {
      setScanning(false);
    }
  };

  const addDest = async () => {
    const dir = await window.jmcp.dialog.pickDir('Ziel-Laufwerk / Ordner wählen');
    if (!dir) return;
    if (dests.some((d) => d.basePath === dir)) return;
    setDests((prev) => [...prev, { id: crypto.randomUUID(), basePath: dir }]);
  };

  const canStart =
    !job.running && !!scan && scan.files.length > 0 && dests.length > 0 && !!template;

  const start = async () => {
    if (!scan || !template) return;
    const date = new Date();
    const subPath = resolvePattern(template.pattern, tState.fields, date);
    const destinations: Destination[] = dests.map((d) => ({
      id: d.id,
      basePath: d.basePath,
      subPath,
      subfolders: template.subfolders,
    }));
    const jobId = crypto.randomUUID();
    const spec: CopySpec = { jobId, source: scan, destinations, verify, alsoMd5, writeMhl };
    job.start(jobId, scan.files);
    await window.jmcp.copy.start(spec);
  };

  const cancel = () => {
    if (job.jobId) window.jmcp.copy.cancel(job.jobId);
  };

  const p = job.progress;
  const overall = p ? p.bytesDone / Math.max(1, p.bytesTotal) : 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Source */}
      <Card>
        <div className="p-5">
          <SectionTitle index={1} title="Quelle" hint="Footage von Karte/Ordner" />
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={pickSource} disabled={job.running}>
              Quelle wählen…
            </Button>
            {scanning && (
              <span className="text-sm text-[var(--muted-foreground)]">Lese Quelle…</span>
            )}
            {scan && !scanning && (
              <span className="text-sm">
                <strong className="tabular">{scan.files.length}</strong> Dateien ·{' '}
                <strong className="tabular">{formatBytes(scan.totalBytes)}</strong>
                <span className="text-[var(--muted-foreground)]"> · ab </span>
                <code className="text-xs">{scan.root}</code>
              </span>
            )}
          </div>
          {scan && scan.skipped.length > 0 && (
            <p className="mt-2 text-xs text-[var(--destructive)]">
              {scan.skipped.length} Einträge übersprungen (nicht lesbar).
            </p>
          )}
        </div>
      </Card>

      {/* Destinations */}
      <Card>
        <div className="p-5">
          <SectionTitle index={2} title="Ziele" hint="Ein oder mehrere — parallel & verifiziert" />
          <div className="space-y-2">
            {dests.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)]
                           border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{d.basePath}</div>
                  <div className="text-xs text-[var(--muted-foreground)] truncate">
                    → {subPathPreview ? `${d.basePath}/${subPathPreview}` : d.basePath}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDests((prev) => prev.filter((x) => x.id !== d.id))}
                  disabled={job.running}
                  className="shrink-0 h-8 px-2 text-xs font-bold rounded-[var(--radius)]
                             text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-40"
                >
                  Entfernen
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={addDest} disabled={job.running}>
              + Ziel hinzufügen
            </Button>
          </div>
        </div>
      </Card>

      {/* Master folder template */}
      <Card>
        <div className="p-5">
          <SectionTitle index={3} title="Master-Ordner" hint="Baukasten-Vorlage" />
          <MasterFolderControls />
          {template && template.subfolders.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {template.subfolders.map((s) => (
                <span
                  key={s}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full
                             bg-[var(--highlight)] text-[var(--foreground)]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Options + start */}
      <Card>
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Toggle on={verify} onClick={() => setVerify(!verify)} label="Verifizieren" />
            <Toggle on={writeMhl} onClick={() => setWriteMhl(!writeMhl)} label="MHL-Protokoll" />
            <Toggle on={alsoMd5} onClick={() => setAlsoMd5(!alsoMd5)} label="+ MD5" />
          </div>
          {job.running ? (
            <Button variant="destructive" onClick={cancel}>
              Abbrechen
            </Button>
          ) : (
            <Button onClick={start} disabled={!canStart}>
              Kopieren starten
            </Button>
          )}
        </div>
      </Card>

      {/* Progress */}
      {(job.running || job.progress) && p && (
        <Card>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">
                {p.filesDone}/{p.filesTotal} Dateien · {phaseLabel(p.phase)}
              </span>
              <span className="tabular text-[var(--muted-foreground)]">
                {formatBytes(p.bytesPerSec)}/s · noch {formatEta(p.etaSec)}
              </span>
            </div>
            <ProgressBar value={overall} />
            <div className="text-xs text-[var(--muted-foreground)] truncate">{p.currentRelPath}</div>
          </div>
        </Card>
      )}

      {/* Result summary */}
      {job.result && <ResultSummary />}

      {/* File list */}
      {job.rows.length > 0 && (
        <Card>
          <div className="p-2">
            <div className="max-h-[320px] overflow-auto scroll-thin divide-y divide-[var(--border)]/40">
              {job.rows.map((row, i) => (
                <FileRowItem key={i} row={row} />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function ResultSummary() {
  const result = useJob((s) => s.result)!;
  const reveal = (path: string) => window.jmcp.shell.reveal(path);
  const allOk = result.failed === 0 && !result.canceled;
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold',
              allOk
                ? 'bg-[var(--highlight)] text-[var(--primary)]'
                : 'bg-[var(--destructive)]/15 text-[var(--destructive)]',
            )}
          >
            {allOk ? '✓' : '!'}
          </span>
          <div>
            <div className="font-extrabold">
              {result.canceled
                ? 'Abgebrochen'
                : allOk
                  ? 'Alles verifiziert'
                  : `${result.failed} Datei(en) mit Problemen`}
            </div>
            <div className="text-sm text-[var(--muted-foreground)] tabular">
              {result.verified} verifiziert · {result.failed} Fehler ·{' '}
              {formatBytes(result.totalBytes)} ·{' '}
              {(result.durationMs / 1000).toFixed(1)} s
            </div>
          </div>
        </div>
        {result.destinations.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {result.destinations.map((d) => (
              <div key={d.folder} className="flex items-center justify-between gap-3 text-sm">
                <code className="text-xs truncate">{d.folder}</code>
                <div className="flex items-center gap-2 shrink-0">
                  {d.mhlPath && (
                    <span className="text-[10px] uppercase tracking-wide font-bold text-[var(--muted-foreground)]">
                      MHL ✓
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => reveal(d.folder)}
                    className="text-xs font-bold text-[var(--primary)] hover:underline"
                  >
                    Im Finder zeigen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function FileRowItem({ row }: { row: FileRow }) {
  const meta = STATUS_META[row.status];
  const active = row.status === 'copying' || row.status === 'verifying';
  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <span className={cn('w-4 text-center font-bold', meta.cls)}>{meta.icon}</span>
      <span className="flex-1 min-w-0 text-sm truncate">{row.relPath}</span>
      {active && <span className="w-24"><ProgressBar value={row.fileFraction} /></span>}
      <span className="w-20 text-right text-xs tabular text-[var(--muted-foreground)]">
        {formatBytes(row.sizeBytes)}
      </span>
      <span className={cn('w-24 text-right text-xs font-semibold', meta.cls)}>
        {row.error ? '' : meta.label}
      </span>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 px-3 rounded-[var(--radius)] text-xs font-bold uppercase tracking-wide border transition-colors',
        on
          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
          : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {on ? '● ' : '○ '}
      {label}
    </button>
  );
}

function SectionTitle({ index, title, hint }: { index: number; title: string; hint: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-2">
      <span className="text-[var(--primary)] font-extrabold">{index}</span>
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <span className="text-xs text-[var(--muted-foreground)]">{hint}</span>
    </div>
  );
}

function phaseLabel(phase: 'copy' | 'verify' | 'mhl'): string {
  return phase === 'copy' ? 'Kopiert' : phase === 'verify' ? 'Verifiziert' : 'Schreibt MHL';
}
