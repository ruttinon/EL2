import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installLocalEnergylinkFallback } from './localEnergylink';
import { installEngineBackedEnergylinkBridge } from './engineApiBridge';
import { ModalProvider } from './context/ModalContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/editor.css';

installLocalEnergylinkFallback();
installEngineBackedEnergylinkBridge();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ModalProvider>
        <App />
      </ModalProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
