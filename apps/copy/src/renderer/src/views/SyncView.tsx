import { Button, cn } from '@jm/ui';
import type { SyncJob, SyncTargetPlan } from '@shared/types';
import { useSync } from '@/store/sync';
import { ProgressBar } from '@/components/ProgressBar';
import { basename, formatBytes, formatEta } from '@/lib/format';

export function SyncView() {
  const jobs = useSync((s) => s.jobs);
  const selectedId = useSync((s) => s.selectedId);
  const select = useSync((s) => s.select);
  const createJob = useSync((s) => s.createJob);

  const job = jobs.find((j) => j.id === selectedId) ?? null;

  return (
    <div className="h-full flex">
      {/* Job-Liste */}
      <aside className="w-72 shrink-0 border-r border-[var(--border)]/60 flex flex-col">
        <div className="p-3">
          <Button size="sm" variant="primary" className="w-full" onClick={() => void createJob('Neuer Sync')}>
            + Neuer Sync
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-2 space-y-1">
          {jobs.length === 0 && (
            <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
              Noch keine Sync-Jobs. Lege einen an, um einen Ordner auf BackUp-Rechner zu spiegeln.
            </p>
          )}
          {jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => select(j.id)}
              className={cn(
                'w-full text-left rounded-[var(--radius)] px-3 py-2 transition-colors',
                j.id === selectedId
                  ? 'bg-[var(--highlight)] text-[var(--foreground)]'
                  : 'text-[var(--foreground)]/80 hover:bg-[var(--highlight)]',
              )}
            >
              <div className="text-sm font-bold truncate">{j.name}</div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)] truncate">
                {j.sourcePath ? basename(j.sourcePath) : 'keine Quelle'} · {j.targets.length} Ziel
                {j.targets.length === 1 ? '' : 'e'}
              </div>
              {j.lastRun && (
                <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                  zuletzt: {j.lastRun.copied} kopiert · {j.lastRun.deleted} gelöscht
                  {j.lastRun.failed ? ` · ${j.lastRun.failed} Fehler` : ''}
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Editor / Ausführung */}
      <div className="flex-1 overflow-auto">
        {job ? (
          <JobPanel job={job} />
        ) : (
          <div className="h-full grid place-items-center text-sm text-[var(--muted-foreground)]">
            Wähle links einen Sync-Job oder lege einen neuen an.
          </div>
        )}
      </div>
    </div>
  );
}

function JobPanel({ job }: { job: SyncJob }) {
  const saveJob = useSync((s) => s.saveJob);
  const removeJob = useSync((s) => s.removeJob);
  const runPreview = useSync((s) => s.runPreview);
  const run = useSync((s) => s.run);
  const cancel = useSync((s) => s.cancel);
  const preview = useSync((s) => s.preview);
  const previewing = useSync((s) => s.previewing);
  const running = useSync((s) => s.running);
  const progress = useSync((s) => s.progress);
  const result = useSync((s) => s.result);

  const patch = (partial: Partial<SyncJob>): void => void saveJob({ ...job, ...partial });

  const pickSource = async (): Promise<void> => {
    const p = await window.jmcp.dialog.pickDir('Quellordner (Main)');
    if (p) patch({ sourcePath: p });
  };
  const addTarget = async (): Promise<void> => {
    const p = await window.jmcp.dialog.pickDir('Zielordner (BackUp)');
    if (p && !job.targets.some((t) => t.path === p)) {
      patch({ targets: [...job.targets, { id: crypto.randomUUID(), path: p }] });
    }
  };

  const ready = Boolean(job.sourcePath) && job.targets.length > 0;
  const showPreview = preview && preview.jobId === job.id;
  const livePct = progress && progress.bytesTotal > 0 ? progress.bytesDone / progress.bytesTotal : 0;

  return (
    <div className="max-w-[820px] mx-auto px-7 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <input
          key={job.id}
          defaultValue={job.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== job.name) patch({ name: v });
          }}
          className="flex-1 h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-base font-extrabold"
        />
        <Button size="sm" variant="ghost" onClick={() => void removeJob(job.id)}>
          Löschen
        </Button>
      </div>

      {/* Quelle */}
      <Section title="Quelle (Main)">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => void pickSource()}>
            Quellordner wählen
          </Button>
          <span className="truncate text-xs text-[var(--muted-foreground)]">
            {job.sourcePath || 'Kein Ordner gewählt'}
          </span>
        </div>
      </Section>

      {/* Ziele */}
      <Section title="Ziele (BackUp-Rechner / Netzwerkpfade)">
        <div className="space-y-2">
          {job.targets.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2">
              <span className="flex-1 truncate text-sm">{t.path}</span>
              <button
                type="button"
                onClick={() => patch({ targets: job.targets.filter((x) => x.id !== t.id) })}
                className="text-[11px] uppercase tracking-wide font-extrabold text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
              >
                Entfernen
              </button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => void addTarget()}>
            + Ziel hinzufügen
          </Button>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Tipp: Netzwerkfreigaben als gemounteten Pfad angeben (Windows: <code>\\HOST\Freigabe</code> oder
            <code> Z:\…</code>, Mac: <code>/Volumes/…</code>).
          </p>
        </div>
      </Section>

      {/* Optionen */}
      <Section title="Optionen">
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={job.mirror} onChange={(e) => patch({ mirror: e.target.checked })} />
            <span>
              <b>Spiegeln</b> — am Ziel zusätzliche Dateien löschen (Ziel wird exakt wie die Quelle)
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={job.verify} onChange={(e) => patch({ verify: e.target.checked })} />
            <span>Kopierte Dateien per Prüfsumme (xxHash64) gegen die Quelle verifizieren</span>
          </label>
        </div>
      </Section>

      {/* Aktionen */}
      <div className="flex items-center gap-3 border-t border-[var(--border)]/60 pt-5">
        <Button variant="outline" disabled={!ready || previewing || running} onClick={() => void runPreview(job.id)}>
          {previewing ? 'Prüfe…' : 'Vorschau'}
        </Button>
        {running ? (
          <Button variant="ghost" onClick={() => void cancel(job.id)}>
            Abbrechen
          </Button>
        ) : (
          <Button variant="primary" disabled={!ready} onClick={() => void run(job.id)}>
            Jetzt syncen
          </Button>
        )}
        {!ready && (
          <span className="text-xs text-[var(--muted-foreground)]">Quelle + mindestens ein Ziel wählen.</span>
        )}
      </div>

      {/* Fortschritt */}
      {running && progress && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4 space-y-2">
          <ProgressBar value={livePct} />
          <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] tabular">
            <span>
              {progress.phase === 'delete' ? 'Lösche' : progress.phase === 'copy' ? 'Kopiere' : 'Vergleiche'} ·{' '}
              {progress.filesDone}/{progress.filesTotal}
            </span>
            <span className="flex gap-3">
              {progress.bytesPerSec > 0 && <span>{formatBytes(progress.bytesPerSec)}/s</span>}
              {progress.etaSec > 0 && <span>noch {formatEta(progress.etaSec)}</span>}
            </span>
          </div>
          <div className="truncate text-[11px] text-[var(--muted-foreground)]">{progress.currentRelPath}</div>
        </div>
      )}

      {/* Ergebnis */}
      {result && result.jobId === job.id && !running && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--primary)]/40 bg-[var(--highlight)] p-4">
          <div className="text-sm font-extrabold">
            {result.canceled ? 'Abgebrochen' : 'Sync abgeschlossen'}
          </div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            {result.copied} kopiert · {result.deleted} gelöscht
            {result.failed ? ` · ${result.failed} Fehler` : ''} · {formatBytes(result.bytes)} ·{' '}
            {(result.durationMs / 1000).toFixed(1)} s
          </div>
          {result.targets.some((t) => t.error) && (
            <ul className="mt-2 text-xs text-[var(--destructive)] space-y-0.5">
              {result.targets
                .filter((t) => t.error)
                .map((t, i) => (
                  <li key={i}>
                    {t.targetPath || 'Ziel'}: {t.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* Vorschau */}
      {showPreview && (
        <div className="space-y-3">
          {preview.sourceMissing ? (
            <p className="text-sm text-[var(--destructive)] font-bold">Quellordner nicht erreichbar.</p>
          ) : (
            <>
              <div className="text-xs text-[var(--muted-foreground)]">
                Vorschau: {preview.totalFiles} Aktionen · {formatBytes(preview.totalBytes)} zu übertragen
              </div>
              {preview.targets.map((t) => (
                <TargetPreview key={t.targetId} plan={t} mirror={job.mirror} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TargetPreview({ plan, mirror }: { plan: SyncTargetPlan; mirror: boolean }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-bold">{plan.targetPath}</span>
        {plan.reachable ? (
          <span className="shrink-0 text-[11px] text-[var(--muted-foreground)] tabular">
            +{plan.copy} neu · {plan.update} aktualisiert
            {mirror ? ` · ${plan.del} gelöscht` : ''} · {formatBytes(plan.bytes)}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-bold text-[var(--destructive)]">
            {plan.error ?? 'nicht erreichbar'}
          </span>
        )}
      </div>
      {mirror && plan.del > 0 && (
        <p className="mt-1 text-[11px] font-bold text-[var(--destructive)]">
          ⚠ {plan.del} Datei{plan.del === 1 ? '' : 'en'} werden am Ziel gelöscht.
        </p>
      )}
      {plan.items.length > 0 && (
        <div className="mt-2 max-h-44 overflow-auto rounded-[var(--radius)] border border-[var(--border)]/50 divide-y divide-[var(--border)]/30 text-[11px]">
          {plan.items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1">
              <span
                className={cn(
                  'shrink-0 w-16 font-extrabold uppercase tracking-wide',
                  it.action === 'delete'
                    ? 'text-[var(--destructive)]'
                    : it.action === 'update'
                      ? 'text-[var(--primary)]'
                      : 'text-[var(--muted-foreground)]',
                )}
              >
                {it.action === 'copy' ? 'Neu' : it.action === 'update' ? 'Update' : 'Löschen'}
              </span>
              <span className="flex-1 truncate">{it.relPath}</span>
              {it.action !== 'delete' && (
                <span className="shrink-0 text-[var(--muted-foreground)] tabular">{formatBytes(it.sizeBytes)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)] mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}
