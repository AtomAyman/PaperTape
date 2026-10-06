import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { CropOverlay } from './components/CropOverlay';
import { setupTauriBridge } from './tauriBridge';
import './styles/paper.css';

setupTauriBridge();

const isCropMode = window.location.hash.includes('crop');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isCropMode ? <CropOverlay /> : <App />}
  </React.StrictMode>
);
