import { useState } from 'react';
import { cn } from '@jm/ui';
import { useJobs, type JobItem } from '@/store/jobs';
import { JobCard } from './JobCard';

const FINISHED: JobItem['status'][] = ['done', 'error', 'canceled'];

/**
 * Rechtsseitige Warteschlange (Issue #10): aktive Aufträge oben, erledigte
 * darunter als aufklappbares Dropdown.
 */
export function JobsSidebar() {
  const jobs = useJobs((s) => s.jobs);
  const clearFinished = useJobs((s) => s.clearFinished);
  const [showDone, setShowDone] = useState(false);

  const active = jobs.filter((j) => !FINISHED.includes(j.status));
  const finished = jobs.filter((j) => FINISHED.includes(j.status));

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 pb-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          Warteschlange{active.length > 0 ? ` (${active.length})` : ''}
        </h2>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4 space-y-3">
        {active.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">Keine aktiven Aufträge.</p>
        )}
        {active.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}

        {finished.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn('transition-transform', showDone && 'rotate-90')}
                  aria-hidden
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                Erledigt ({finished.length})
              </button>
              <button
                type="button"
                onClick={clearFinished}
                className="text-[11px] uppercase tracking-wide font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Leeren
              </button>
            </div>
            {showDone && (
              <div className="mt-3 space-y-3">
                {finished.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
