import type { ReactNode } from 'react';
import { Topbar } from './Topbar';
import type { Section } from '@/App';

interface Props {
  section: Section;
  onSection: (section: Section) => void;
  /** Contextual controls rendered in the topbar (e.g. export/import buttons). */
  topbarExtra?: ReactNode;
  children: ReactNode;
}

/**
 * Full-bleed shell for an editor-style app: the topbar stays fixed and the
 * content area fills the remaining height without its own scroll, so views
 * (canvas viewport, panels) manage their own layout.
 */
export function AppShell({ section, onSection, topbarExtra, children }: Props) {
  return (
    <div className="h-full flex flex-col">
      <Topbar section={section} onSection={onSection}>
        {topbarExtra}
      </Topbar>
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
