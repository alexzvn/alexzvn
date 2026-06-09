import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { MeasureView } from './views/MeasureView';
import { GeneratorView } from './views/GeneratorView';
import { CalibrateView } from './views/CalibrateView';

export type Section = 'measure' | 'generator' | 'calibrate';

export function App() {
  const [section, setSection] = useState<Section>('measure');

  return (
    <AppShell section={section} onSection={setSection}>
      {section === 'measure' && <MeasureView />}
      {section === 'generator' && <GeneratorView />}
      {section === 'calibrate' && <CalibrateView />}
    </AppShell>
  );
}
