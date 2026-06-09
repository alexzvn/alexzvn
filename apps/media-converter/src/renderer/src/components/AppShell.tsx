import type { ReactNode } from 'react';
import { Topbar } from './Topbar';
import { JobsSidebar } from './JobsSidebar';
import { useJobs } from '@/store/jobs';
import type { Section } from '@/App';

interface Props {
  section: Section;
  onSection: (section: Section) => void;
  children: ReactNode;
}

export function AppShell({ section, onSection, children }: Props) {
  const hasJobs = useJobs((s) => s.jobs.length > 0);
  return (
    <div className="h-full flex flex-col">
      <Topbar section={section} onSection={onSection} />
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1000px] mx-auto px-7 py-6">{children}</div>
        </main>
        {hasJobs && (
          <aside className="w-[340px] shrink-0 border-l border-[var(--border)] bg-[var(--card)]/30">
            <JobsSidebar />
          </aside>
        )}
      </div>
    </div>
  );
}
