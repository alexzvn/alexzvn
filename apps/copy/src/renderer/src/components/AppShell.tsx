import type { ReactNode } from 'react';
import { Topbar } from './Topbar';
import type { Section } from '@/App';

interface Props {
  section: Section;
  onSection: (section: Section) => void;
  children: ReactNode;
}

export function AppShell({ section, onSection, children }: Props) {
  return (
    <div className="h-full flex flex-col">
      <Topbar section={section} onSection={onSection} />
      <main className="flex-1 overflow-auto scroll-thin">
        <div className="max-w-[1200px] mx-auto px-7 py-6 h-full">{children}</div>
      </main>
    </div>
  );
}
