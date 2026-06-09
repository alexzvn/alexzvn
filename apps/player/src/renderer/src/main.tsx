import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { OutputView } from './views/OutputView';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Das Video-Ausgabefenster lädt denselben Renderer mit #output und rendert nur
// die schlanke OutputView (kein Store/keine Haupt-UI).
const isOutput = window.location.hash === '#output';

createRoot(root).render(
  <StrictMode>{isOutput ? <OutputView /> : <App />}</StrictMode>,
);
