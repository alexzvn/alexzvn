import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { VideoView } from './views/VideoView';
import { DocumentView } from './views/DocumentView';
import { useJobs } from './store/jobs';

export type Section = 'video' | 'office';

export function App() {
  const [section, setSection] = useState<Section>('video');
  const patch = useJobs((s) => s.patch);

  useEffect(() => {
    const offProgress = window.jmc.onProgress((p) => {
      patch(p.jobId, {
        status: 'running',
        percent: p.percent < 0 ? -1 : p.percent,
        fps: p.fps,
        speed: p.speed,
        etaSec: p.etaSec,
      });
    });
    const offDone = window.jmc.onDone((r) => {
      patch(r.jobId, {
        status: r.canceled ? 'canceled' : r.success ? 'done' : 'error',
        ...(r.success ? { percent: 100 } : {}),
        outputPath: r.outputPath,
        error: r.error,
      });
    });
    return () => {
      offProgress();
      offDone();
    };
  }, [patch]);

  return (
    <AppShell section={section} onSection={setSection}>
      {section === 'video' ? <VideoView /> : <DocumentView />}
    </AppShell>
  );
}
