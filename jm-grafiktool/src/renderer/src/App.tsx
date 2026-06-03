import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { EditorView } from './views/EditorView';
import { BibliothekView } from './views/BibliothekView';
import { EditorActions } from './components/editor/EditorActions';

export type Section = 'editor' | 'bibliothek';

export function App() {
  const [section, setSection] = useState<Section>('editor');

  return (
    <AppShell
      section={section}
      onSection={setSection}
      topbarExtra={section === 'editor' ? <EditorActions /> : null}
    >
      {section === 'editor' ? <EditorView /> : <BibliothekView />}
    </AppShell>
  );
}
