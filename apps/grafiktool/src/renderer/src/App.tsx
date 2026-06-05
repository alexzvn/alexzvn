import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { EditorView } from './views/EditorView';
import { BibliothekView } from './views/BibliothekView';
import { EditorActions } from './components/editor/EditorActions';
import { cn } from '@jm/ui';

export type Section = 'editor' | 'bibliothek';

export function App() {
  const [section, setSection] = useState<Section>('editor');

  return (
    <AppShell
      section={section}
      onSection={setSection}
      topbarExtra={section === 'editor' ? <EditorActions /> : null}
    >
      {/* The editor stays mounted (keeps the document + engine alive) and is
          just hidden when another section is active. */}
      <div className={cn('h-full', section !== 'editor' && 'hidden')}>
        <EditorView />
      </div>
      {section === 'bibliothek' && <BibliothekView onInserted={() => setSection('editor')} />}
    </AppShell>
  );
}
