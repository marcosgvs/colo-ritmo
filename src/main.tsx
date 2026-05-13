import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { iniciarMonitoramento } from './lib/monitoring';
import './tokens/colors_and_type.css';
import './styles/global.css';

iniciarMonitoramento();

const root = document.getElementById('root');
if (!root) throw new Error('root mount node não encontrado em index.html');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
