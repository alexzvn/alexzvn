import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './globals.css';
import { docToPsdBytes, psdToDoc } from './engine/io/psd';
import { docToJmgBytes, jmgToDoc } from './engine/io/project';

// Debug surface for headless verification / quick console inspection.
(window as unknown as { __io?: unknown }).__io = { docToPsdBytes, psdToDoc, docToJmgBytes, jmgToDoc };

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
