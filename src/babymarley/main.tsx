import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../tokens/colors_and_type.css';
import '../styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('root mount node não encontrado em babymarley.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
