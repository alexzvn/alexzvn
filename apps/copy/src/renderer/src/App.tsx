import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { CopyView } from './views/CopyView';
import { TemplatesView } from './views/TemplatesView';
import { VerifyView } from './views/VerifyView';
import { SyncView } from './views/SyncView';
import { useJob } from './store/job';
import { useSync } from './store/sync';

export type Section = 'copy' | 'sync' | 'templates' | 'verify';

export function App() {
  const [section, setSection] = useState<Section>('copy');
  const applyFile = useJob((s) => s.applyFile);
  const applyJob = useJob((s) => s.applyJob);
  const finish = useJob((s) => s.finish);
  const loadSync = useSync((s) => s.load);
  const applySyncProgress = useSync((s) => s.applyProgress);
  const applySyncDone = useSync((s) => s.applyDone);

  useEffect(() => {
    const offFile = window.jmcp.onFileProgress(applyFile);
    const offJob = window.jmcp.onJobProgress(applyJob);
    const offDone = window.jmcp.onDone(finish);
    const offSyncProgress = window.jmcp.onSyncProgress(applySyncProgress);
    const offSyncDone = window.jmcp.onSyncDone(applySyncDone);
    void loadSync();
    return () => {
      offFile();
      offJob();
      offDone();
      offSyncProgress();
      offSyncDone();
    };
  }, [applyFile, applyJob, finish, loadSync, applySyncProgress, applySyncDone]);

  return (
    <AppShell section={section} onSection={setSection}>
      {section === 'copy' && <CopyView />}
      {section === 'sync' && <SyncView />}
      {section === 'templates' && <TemplatesView />}
      {section === 'verify' && <VerifyView />}
    </AppShell>
  );
}
