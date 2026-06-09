import { useEffect, useState } from 'react';
import { Topbar } from '@/components/Topbar';
import { LibraryView } from '@/views/LibraryView';
import { SoundboardView } from '@/views/SoundboardView';
import { usePlayer } from '@/store/player';

export type Section = 'library' | 'soundboard';

export function App() {
  const load = usePlayer((s) => s.load);
  const notice = usePlayer((s) => s.notice);
  const setNotice = usePlayer((s) => s.setNotice);
  const [section, setSection] = useState<Section>('library');

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  return (
    <div className="h-full flex flex-col">
      <Topbar section={section} onSection={setSection} />
      <main className="flex-1 overflow-hidden">
        {section === 'library' ? <LibraryView /> : <SoundboardView />}
      </main>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center px-6">
          <div
            className="pointer-events-auto rounded-[var(--radius-lg)] border border-[var(--primary)]/40
                       bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-xl text-center"
          >
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}
