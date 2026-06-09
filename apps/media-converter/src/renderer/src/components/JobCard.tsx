import type { ReactNode } from 'react';
import { useJobs, type JobItem } from '@/store/jobs';
import { ProgressBar } from './ProgressBar';
import { cn } from '@jm/ui';
import { basename, formatEta } from '@/lib/format';

const STATUS_LABEL: Record<JobItem['status'], string> = {
  queued: 'In Warteschlange',
  running: 'Läuft',
  done: 'Fertig',
  error: 'Fehler',
  canceled: 'Abgebrochen',
};

const STATUS_TONE: Record<JobItem['status'], string> = {
  queued: 'text-[var(--muted-foreground)] border-[var(--border)]',
  running: 'text-[var(--primary)] border-[var(--primary)]/40',
  done: 'text-[var(--primary)] border-[var(--primary)]/40',
  error: 'text-[var(--destructive)] border-[var(--destructive)]/50',
  canceled: 'text-[var(--muted-foreground)] border-[var(--border)]',
};

export function JobCard({ job }: { job: JobItem }) {
  const remove = useJobs((s) => s.remove);
  const isActive = job.status === 'queued' || job.status === 'running';
  const tone = job.status === 'error' || job.status === 'canceled' ? 'muted' : 'primary';

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{job.fileName || basename(job.inputPath)}</p>
          {job.presetLabel && (
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
              {job.presetLabel}
            </p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-[var(--radius-sm)] border px-2 py-0.5',
            'text-[10px] uppercase tracking-[0.12em] font-extrabold',
            STATUS_TONE[job.status],
          )}
        >
          {STATUS_LABEL[job.status]}
        </span>
      </div>

      {isActive && (
        <div className="mt-3 space-y-1.5">
          <ProgressBar percent={job.percent} tone={tone === 'muted' ? 'muted' : 'primary'} />
          <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] tabular">
            <span>{job.percent >= 0 ? `${job.percent.toFixed(0)} %` : 'Wird verarbeitet…'}</span>
            <span className="flex gap-3">
              {job.speed && <span>{job.speed}</span>}
              {job.fps != null && job.fps > 0 && <span>{job.fps.toFixed(0)} fps</span>}
              {job.etaSec != null && <span>noch {formatEta(job.etaSec)}</span>}
            </span>
          </div>
        </div>
      )}

      {job.status === 'error' && job.error && (
        <p className="mt-2 text-xs text-[var(--destructive)]">{job.error}</p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        {job.kind === 'video' && isActive && (
          <ActionButton onClick={() => window.jmc.video.cancel(job.id)}>Abbrechen</ActionButton>
        )}
        {job.status === 'done' && job.outputPath && (
          <ActionButton onClick={() => window.jmc.shell.reveal(job.outputPath!)}>
            Im Ordner zeigen
          </ActionButton>
        )}
        {!isActive && <ActionButton onClick={() => remove(job.id)}>Entfernen</ActionButton>}
      </div>
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 px-3 rounded-[var(--radius)] text-[11px] uppercase tracking-wide font-extrabold',
        'border border-[var(--border)] text-[var(--foreground)]',
        'hover:bg-[var(--highlight)] transition-colors',
      )}
    >
      {children}
    </button>
  );
}
