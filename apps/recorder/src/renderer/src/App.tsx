import { useEffect } from 'react';
import { Topbar } from '@/components/Topbar';
import { RecorderView } from '@/views/RecorderView';
import { useRec } from '@/store/recorder';

export function App() {
  const init = useRec((s) => s.init);
  const notice = useRec((s) => s.notice);
  const setNotice = useRec((s) => s.setNotice);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  return (
    <div className="h-full flex flex-col">
      <Topbar />
      <main className="flex-1 overflow-auto scroll-thin">
        <RecorderView />
      </main>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center px-6">
          <div
            className="pointer-events-auto rounded-[var(--radius-lg)] border border-[var(--primary)]/40
                       bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-2xl text-center truncate"
          >
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}
