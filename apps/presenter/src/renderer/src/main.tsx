import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from './views/EditorView';
import { PresenterView } from './views/PresenterView';
import { AudienceView } from './views/AudienceView';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const view = window.jmpr?.view ?? 'editor';

createRoot(root).render(
  <StrictMode>
    {view === 'presenter' ? (
      <PresenterView />
    ) : view === 'audience' ? (
      <AudienceView />
    ) : (
      <EditorView />
    )}
  </StrictMode>,
);
