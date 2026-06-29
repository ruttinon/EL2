import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/monitor.css';
import './styles/monitor-futuristic.css';
import '@energylink/unified-viewport/src/unified-viewport.css';
import { MonitorThemeProvider } from './components/MonitorThemeProvider';
import { MonitorShell } from './MonitorShell';
import { applyThemeTokens, loadThemeState, resolveThemeTokens } from './utils/monitorTheme';

applyThemeTokens(resolveThemeTokens(loadThemeState()));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MonitorThemeProvider>
      <MonitorShell />
    </MonitorThemeProvider>
  </React.StrictMode>
);
