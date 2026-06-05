import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { CopyView } from './views/CopyView';
import { TemplatesView } from './views/TemplatesView';
import { VerifyView } from './views/VerifyView';
import { useJob } from './store/job';

export type Section = 'copy' | 'templates' | 'verify';

export function App() {
  const [section, setSection] = useState<Section>('copy');
  const applyFile = useJob((s) => s.applyFile);
  const applyJob = useJob((s) => s.applyJob);
  const finish = useJob((s) => s.finish);

  useEffect(() => {
    const offFile = window.jmcp.onFileProgress(applyFile);
    const offJob = window.jmcp.onJobProgress(applyJob);
    const offDone = window.jmcp.onDone(finish);
    return () => {
      offFile();
      offJob();
      offDone();
    };
  }, [applyFile, applyJob, finish]);

  return (
    <AppShell section={section} onSection={setSection}>
      {section === 'copy' && <CopyView />}
      {section === 'templates' && <TemplatesView />}
      {section === 'verify' && <VerifyView />}
    </AppShell>
  );
}
