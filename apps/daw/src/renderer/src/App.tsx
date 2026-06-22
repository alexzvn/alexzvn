import { useEffect, useState } from 'react';
import '@fontsource-variable/manrope';
import { Topbar } from './components/Topbar';
import { Transport } from './components/Transport';
import { RecordBar } from './components/RecordBar';
import { MediaBin } from './components/MediaBin';
import { Timeline } from './components/Timeline';
import { Inspector } from './components/Inspector';
import { Mixer } from './components/Mixer';
import { ExportDialog } from './components/ExportDialog';
import { useProject } from './store/project';
import { useLiveMix, useTransport } from './lib/transport';
import { saveProjectFlow } from './lib/actions';

export function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const setExportStatus = useProject((s) => s.setExportStatus);
  const setRecLevels = useProject((s) => s.setRecLevels);
  const setRecFromMain = useProject((s) => s.setRecFromMain);

  useTransport();
  useLiveMix();

  // IPC-Events abonnieren.
  useEffect(() => {
    const offEP = window.jmdaw.onExportProgress((p) =>
      setExportStatus({ running: true, percent: p.percent }),
    );
    const offED = window.jmdaw.onExportDone((r) => {
      if (r.canceled) {
        setExportStatus({ running: false, percent: 0, message: 'Abgebrochen', error: undefined });
      } else if (r.success) {
        setExportStatus({ running: false, percent: 100, lastOutput: r.outputPath, error: undefined, message: 'Fertig' });
      } else {
        setExportStatus({ running: false, error: r.error ?? 'Export fehlgeschlagen' });
      }
    });
    const offRL = window.jmdaw.onRecLevels((l) => setRecLevels(l.peaks));
    const offRS = window.jmdaw.onRecState((s) => setRecFromMain(s));
    return () => {
      offEP();
      offED();
      offRL();
      offRS();
    };
  }, [setExportStatus, setRecLevels, setRecFromMain]);

  // Tastenkürzel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      const st = useProject.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveProjectFlow(false);
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        st.redo();
      } else if (e.key === ' ') {
        e.preventDefault();
        st.setPlaying(!st.playing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        st.deleteSelected();
      } else if (!mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        st.splitAtPlayhead();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Topbar onExport={() => setExportOpen(true)} />
      <Transport />
      <RecordBar />

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex">
          <div className="w-[240px] shrink-0">
            <MediaBin />
          </div>
          <div className="flex-1 min-w-0">
            <Timeline />
          </div>
          <div className="w-[280px] shrink-0">
            <Inspector />
          </div>
        </div>
        <div className="h-[260px] shrink-0">
          <Mixer />
        </div>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
