import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { EditorView } from './views/EditorView';
import { BibliothekView } from './views/BibliothekView';

export type Section = 'editor' | 'bibliothek';

export function App() {
  const [section, setSection] = useState<Section>('editor');

  return (
    <AppShell section={section} onSection={setSection}>
      {section === 'editor' ? <EditorView /> : <BibliothekView />}
    </AppShell>
  );
}
