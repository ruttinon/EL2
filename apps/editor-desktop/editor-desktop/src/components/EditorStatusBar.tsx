import { useCallback, useEffect, useState } from 'react';
import { getEngineUrl, probeEngineUrl } from '@energylink/shared-ui';
import { editorRuntimeApi } from '../api/editorRuntimeApi';

type EngineState = 'online' | 'offline' | 'checking';
type DbState = 'ready' | 'empty' | 'error' | 'checking';

const WEB_VIEWER_KEY = 'energylink.webViewer.url';
const LS_WEB_VIEWER = 'energylink.setup.webviewer.v1';

function readWebViewerUrl(): string {
  if (typeof window === 'undefined') return '';
  const direct = window.localStorage.getItem(WEB_VIEWER_KEY);
  if (direct) return direct;
  try {
    const raw = window.localStorage.getItem(LS_WEB_VIEWER);
    if (!raw) return '';
    const settings = JSON.parse(raw) as { enabled?: boolean; port?: number };
    if (settings.enabled === false || !settings.port) return '';
    return `http://localhost:${settings.port}`;
  } catch {
    return '';
  }
}

export function EditorStatusBar() {
  const [engineState, setEngineState] = useState<EngineState>('checking');
  const [dbState, setDbState] = useState<DbState>('checking');
  const [activeAlarms, setActiveAlarms] = useState(0);
  const [engineUrl, setEngineUrl] = useState(() => getEngineUrl());
  const [webViewerUrl, setWebViewerUrl] = useState(() => readWebViewerUrl());

  const refresh = useCallback(async () => {
    setEngineState('checking');
    const probed = await probeEngineUrl();
    if (probed) {
      setEngineUrl(probed);
      setEngineState('online');
    } else {
      setEngineState('offline');
    }

    try {
      const status = await window.energylink.projects.status();
      setDbState(status.activeProjectId ? 'ready' : 'empty');
    } catch {
      setDbState('error');
    }

    const alarmRes = await editorRuntimeApi.getAlarms();
    if (alarmRes.ok) {
      setActiveAlarms(alarmRes.data.alarms?.filter((a) => a.status === 'active').length ?? 0);
    }

    setWebViewerUrl(readWebViewerUrl());
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const engineDot = engineState === 'online' ? 'green' : engineState === 'checking' ? 'gray' : 'red';
  const alarmDot = activeAlarms > 0 ? 'red' : 'green';

  return (
    <footer className="statusbar">
      <span>
        <i className={`dot ${engineDot}`} />
        Engine: {engineState === 'online' ? 'Online' : engineState === 'checking' ? 'Checking…' : 'Offline'}
      </span>
      <span title={engineUrl}>
        API: {engineState === 'online' ? engineUrl.replace(/^https?:\/\//, '') : 'Not reachable'}
      </span>
      <span>
        Database:{' '}
        {dbState === 'ready' ? 'Project loaded' : dbState === 'empty' ? 'No active project' : dbState === 'checking' ? 'Checking…' : 'Error'}
      </span>
      <span>
        Web Viewer: {webViewerUrl ? webViewerUrl.replace(/^https?:\/\//, '') : 'Not configured'}
      </span>
      <span>
        <i className={`dot ${alarmDot}`} />
        Alarms: {activeAlarms} Active
      </span>
      <span className="right">{new Date().toLocaleDateString('en-GB')}</span>
    </footer>
  );
}

export default EditorStatusBar;
