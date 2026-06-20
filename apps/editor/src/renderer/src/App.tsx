import { useEffect, useState } from 'react';
import '@fontsource-variable/manrope';
import { Topbar } from './components/Topbar';
import { MediaBin } from './components/MediaBin';
import { PreviewMonitor } from './components/PreviewMonitor';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { ExportDialog } from './components/ExportDialog';
import { useProject } from './store/project';
import { saveProjectFlow } from './lib/actions';

export function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const setProxyProgress = useProject((s) => s.setProxyProgress);
  const setProxyDone = useProject((s) => s.setProxyDone);
  const setExportStatus = useProject((s) => s.setExportStatus);

  // IPC-Events abonnieren.
  useEffect(() => {
    const offPP = window.jmed.onProxyProgress((p) => setProxyProgress(p));
    const offPD = window.jmed.onProxyDone((r) => setProxyDone(r));
    const offEP = window.jmed.onExportProgress((p) =>
      setExportStatus({ running: true, percent: p.percent, etaSec: p.etaSec }),
    );
    const offED = window.jmed.onExportDone((r) => {
      if (r.canceled) {
        setExportStatus({ running: false, percent: 0, message: 'Abgebrochen', error: undefined });
      } else if (r.success) {
        setExportStatus({ running: false, percent: 100, lastOutput: r.outputPath, error: undefined, message: 'Fertig' });
      } else {
        setExportStatus({ running: false, error: r.error ?? 'Export fehlgeschlagen' });
      }
    });
    return () => {
      offPP();
      offPD();
      offEP();
      offED();
    };
  }, [setProxyProgress, setProxyDone, setExportStatus]);

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
      } else if (e.key.toLowerCase() === 's') {
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

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex">
          <div className="w-[260px] shrink-0">
            <MediaBin />
          </div>
          <div className="flex-1 min-w-0">
            <PreviewMonitor />
          </div>
          <div className="w-[300px] shrink-0">
            <Inspector />
          </div>
        </div>
        <div className="h-[336px] shrink-0">
          <Timeline />
        </div>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
