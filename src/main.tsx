import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { App } from './App';
import { CropOverlay } from './components/CropOverlay';
import { setupTauriBridge } from './tauriBridge';
import './styles/paper.css';

setupTauriBridge();

let isCropMode = false;
try {
  const currentWin = getCurrentWebviewWindow();
  isCropMode =
    currentWin.label === 'crop-overlay' ||
    window.location.hash.includes('crop') ||
    window.location.search.includes('crop');
} catch {
  isCropMode =
    window.location.hash.includes('crop') ||
    window.location.search.includes('crop');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isCropMode ? <CropOverlay /> : <App />}
  </React.StrictMode>
);
