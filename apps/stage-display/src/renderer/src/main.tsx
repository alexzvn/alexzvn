import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StageOutputView } from './views/StageOutputView';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Das Vollbild-Ausgabefenster lädt denselben Renderer unter #output.
const isOutput = window.location.hash === '#output';

createRoot(root).render(<StrictMode>{isOutput ? <StageOutputView /> : <App />}</StrictMode>);
