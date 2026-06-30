import React from 'react';
import { MonitorPlay, Zap, Palette, ChevronLeft, ChevronRight, Plug, Moon, Sun, Menu, X, Bell } from 'lucide-react';
import { currentEngineUrl, engineApi, probeEngineUrl, setEngineUrl } from './api/engineApi';
import {
  getOperatorRole,
  setOperatorRole,
  initOperatorRoleFromQuery,
  OPERATOR_ROLE_OPTIONS,
  type OperatorRole,
} from '@energylink/shared-ui';
import { StatusBadge } from './components/StatusBadge';
import { UiIcon } from './components/UiIcon';
import { MonitorNavBar } from './components/ViewHelpers';
import { TrendAnalysis } from './components/TrendAnalysis';
import { SidebarDeviceTree } from './components/SidebarDeviceTree';
import { DeviceManagementView } from './components/DeviceManagement';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { NotificationCenter } from './components/NotificationCenter';
import { DashboardView } from './views/DashboardView';
import { calculateTotalPower } from './utils/dashboardMetrics';
import { buildRuntimeIndexes } from './utils/runtimeIndexes';
import {
  connectionStatus,
  defaultState,
  NAV_ITEMS,
  type MonitorState,
  type ViewKey,
} from './appShared';
import {
  AlarmView,
  DeviceDetailsView,
  GraphicsView,
  ReportView,
} from './monitorViews';

export function MonitorShell() {
  const [state, setState] = React.useState<MonitorState>(() => defaultState());
  const kioskMode = React.useMemo(() => new URLSearchParams(window.location.search).get('kiosk') === '1', []);

  React.useEffect(() => {
    initOperatorRoleFromQuery();
  }, []);

  const [operatorRole, setOperatorRoleState] = React.useState<OperatorRole>(() => getOperatorRole());

  React.useEffect(() => {
    if (!kioskMode) return;
    document.body.classList.add('monitor-kiosk-mode');
    setState((cur) => ({ ...cur, activeView: 'graphics' }));
    return () => document.body.classList.remove('monitor-kiosk-mode');
  }, [kioskMode]);

  const refreshGraphic = React.useCallback(async (graphicId?: string) => {
    const result = graphicId ? await engineApi.getGraphic(graphicId) : await engineApi.getDefaultGraphic();
    setState(cur => ({
      ...cur,
      runtimeGraphic: result.ok ? result.data : undefined,
      activeGraphicId: result.ok ? result.data.graphic.id : graphicId,
      graphicsStatus: result.ok ? undefined : { statusCode: result.statusCode, message: result.message },
    }));
  }, []);

  const refreshCurrentValues = React.useCallback(async () => {
    const [currentValues, alarms, polling, carbon, carbonBreakdown] = await Promise.all([
      engineApi.getCurrentValues(),
      engineApi.getAlarms(),
      engineApi.getPollingStatus(),
      engineApi.getCarbonSummary({ period: 'live' }),
      engineApi.getCarbonBreakdown({ period: 'live', by: 'loadCategory' }),
    ]);

    const values = currentValues.ok ? currentValues.data.values ?? [] : [];
    const nextError =
      !currentValues.ok && !alarms.ok
        ? `Unable to fetch runtime values: ${currentValues.message || alarms.message}`
        : undefined;
    const totalPower = calculateTotalPower(values);

    setState(cur => {
      const lastPoint = cur.powerHistory?.[cur.powerHistory.length - 1];
      const history =
        lastPoint && lastPoint.value === totalPower
          ? cur.powerHistory
          : [...(cur.powerHistory ?? []), { time: new Date().toISOString(), value: totalPower }].slice(-40);
      return {
        ...cur,
        lastRefresh: new Date().toLocaleString(),
        pollingStatus: polling.ok ? polling.data : cur.pollingStatus,
        currentValues: values,
        alarms: alarms.ok ? alarms.data.alarms ?? [] : cur.alarms,
        alarmSummary: alarms.ok ? alarms.data.summary : cur.alarmSummary,
        currentValuesStatus: currentValues.ok
          ? undefined
          : { statusCode: currentValues.statusCode, message: currentValues.message },
        alarmsStatus: alarms.ok ? undefined : { statusCode: alarms.statusCode, message: alarms.message },
        error: nextError ?? cur.error,
        powerHistory: history,
        carbonSummary: carbon.ok ? carbon.data : cur.carbonSummary,
        carbonBreakdown: carbonBreakdown.ok ? carbonBreakdown.data : cur.carbonBreakdown,
      };
    });
  }, []);

  const refresh = React.useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setState(cur => ({ ...cur, loading: true, error: undefined }));
      }

      let status = await engineApi.getStatus();
      if (!status.ok) {
        const discovered = await probeEngineUrl();
        if (discovered) {
          setState(cur => ({ ...cur, engineUrl: discovered }));
          status = await engineApi.getStatus();
        }
      }

      const [health, capabilities, polling, devices, graphics, reports, generatedReports, currentValues, alarms, carbon, carbonBreakdown] =
        await Promise.all([
          engineApi.getHealth(),
          engineApi.getCapabilities(),
          engineApi.getPollingStatus(),
          engineApi.getDevices(),
          engineApi.getGraphics(),
          engineApi.getReports(),
          engineApi.getGeneratedReports(),
          engineApi.getCurrentValues(),
          engineApi.getAlarms(),
          engineApi.getCarbonSummary({ period: 'live' }),
          engineApi.getCarbonBreakdown({ period: 'live', by: 'loadCategory' }),
        ]);

      const syncedEngineUrl = health.ok
        ? (health.data as { apiBaseUrl?: string }).apiBaseUrl ?? currentEngineUrl()
        : currentEngineUrl();

      const values = currentValues.ok ? currentValues.data.values ?? [] : [];
      const graphicList = graphics.ok ? graphics.data : [];
      const preferredGraphicId =
        state.activeGraphicId ?? graphicList.find(g => g.isDefault)?.id ?? graphicList[0]?.id;

      let runtimeGraphic = state.runtimeGraphic;
      if (preferredGraphicId) {
        const graphicResult = await engineApi.getGraphic(preferredGraphicId);
        runtimeGraphic = graphicResult.ok ? graphicResult.data : undefined;
      } else {
        const graphicResult = await engineApi.getDefaultGraphic();
        runtimeGraphic = graphicResult.ok ? graphicResult.data : undefined;
      }

      const totalPower = calculateTotalPower(values);
      const nextError =
        !status.ok && !health.ok
          ? `Engine unavailable: ${status.message || health.message}`
          : !devices.ok
            ? `Devices: ${devices.message}`
            : undefined;

      setState(cur => {
        const lastPoint = cur.powerHistory?.[cur.powerHistory.length - 1];
        const history =
          lastPoint && lastPoint.value === totalPower
            ? cur.powerHistory
            : [...(cur.powerHistory ?? []), { time: new Date().toISOString(), value: totalPower }].slice(-40);
        return {
          ...cur,
          loading: false,
          engineUrl: syncedEngineUrl,
          status: status.ok ? status.data : undefined,
          health: health.ok ? health.data : undefined,
          capabilities: capabilities.ok ? capabilities.data : undefined,
          pollingStatus: polling.ok ? polling.data : cur.pollingStatus,
          devices: devices.ok ? devices.data : [],
          graphics: graphicList,
          reports: reports.ok ? reports.data : [],
          generatedReports: generatedReports.ok ? generatedReports.data.files ?? [] : [],
          currentValues: values,
          alarms: alarms.ok ? alarms.data.alarms ?? [] : [],
          alarmSummary: alarms.ok ? alarms.data.summary : undefined,
          runtimeGraphic,
          activeGraphicId: preferredGraphicId,
          error: nextError,
          lastRefresh: new Date().toLocaleString(),
          powerHistory: history,
          carbonSummary: carbon.ok ? carbon.data : cur.carbonSummary,
          carbonBreakdown: carbonBreakdown.ok ? carbonBreakdown.data : cur.carbonBreakdown,
        };
      });
    },
    [state.activeGraphicId, state.runtimeGraphic],
  );

  React.useEffect(() => {
    void refresh({ showLoading: true });
  }, []);

  React.useEffect(() => {
    if (!state.pollingStatus?.running) return undefined;
    const graphicMs = state.activeView === 'graphics' ? state.runtimeGraphic?.graphic.refreshIntervalMs : undefined;
    const intervalMs = graphicMs
      ? Math.max(500, graphicMs)
      : state.refreshSeconds * 1000;
    const timer = window.setInterval(() => void refreshCurrentValues(), intervalMs);
    return () => window.clearInterval(timer);
  }, [state.pollingStatus?.running, state.refreshSeconds, state.activeView, state.runtimeGraphic?.graphic.refreshIntervalMs, refreshCurrentValues]);

  const ackAlarm = React.useCallback(
    async (id: string) => {
      const result = await engineApi.acknowledgeAlarm(id);
      if (result.ok) void refreshCurrentValues();
    },
    [refreshCurrentValues],
  );

  const handleEngineUrl = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const url = String(fd.get('engineUrl') ?? '').trim();
      if (!url) return;
      setEngineUrl(url);
      setState(cur => ({ ...cur, engineUrl: url }));
      void refresh({ showLoading: true });
    },
    [refresh],
  );

  const handleWriteTag = React.useCallback(
    async (tagId: string, tagName: string, dataType: string, options?: { presetValue?: number | boolean; requireConfirm?: boolean }) => {
      const isBool = dataType === 'bool';
      let value: number | boolean;
      if (options?.presetValue !== undefined) {
        value = options.presetValue;
      } else {
        const input = window.prompt(
          isBool
            ? `Enter new value for "${tagName}" (1 = True, 0 = False):`
            : `Enter new value for "${tagName}":`,
        );
        if (input === null || input.trim() === '') return;
        value = isBool ? input.trim() === '1' || input.trim().toLowerCase() === 'true' : Number(input);
        if (!isBool && Number.isNaN(value as number)) return;
      }
      if (options?.requireConfirm && !window.confirm(`Write ${String(value)} to "${tagName}"?`)) return;
      await engineApi.writeTag(tagId, value as number | boolean);
      void refreshCurrentValues();
    },
    [refreshCurrentValues],
  );

  const generateReport = React.useCallback(async (id: string, format: 'pdf' | 'excel') => {
    const result = await engineApi.generateReport(id, format);
    setState(cur => ({
      ...cur,
      reportActionMessage: result.ok ? `Generated ${format.toUpperCase()} report.` : result.message,
    }));
    if (result.ok) void refresh();
  }, [refresh]);

  const startPolling = React.useCallback(async () => {
    const result = await engineApi.startPolling();
    if (result.ok) {
      setState(cur => ({ ...cur, pollingStatus: result.data }));
      void refreshCurrentValues();
    }
  }, [refreshCurrentValues]);

  const stopPolling = React.useCallback(async () => {
    const result = await engineApi.stopPolling();
    if (result.ok) setState(cur => ({ ...cur, pollingStatus: result.data }));
  }, []);

  const connStatus = connectionStatus(state);
  const tags = state.devices.flatMap((d: { tags?: unknown[] }) => d.tags ?? []);
  const runtimeIndexes = React.useMemo(
    () => buildRuntimeIndexes(state.devices, state.currentValues),
    [state.devices, state.currentValues],
  );
  const [sidebarSearch, setSidebarSearch] = React.useState('');
  const [navPanelOpen, setNavPanelOpen] = React.useState(true);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const activeAlarms = state.alarmSummary?.active ?? 0;
  const [statusbarNow, setStatusbarNow] = React.useState(() => new Date());
  const [themeOpen, setThemeOpen] = React.useState(false);

  // ── Dark mode ──────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = React.useState<boolean>(() => {
    try { return localStorage.getItem('energylink:dark-mode') === '1'; } catch { return false; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem('energylink:dark-mode', darkMode ? '1' : '0'); } catch { /* ignore */ }
  }, [darkMode]);

  // ── Toast system ───────────────────────────────────────────────────────
  type Toast = { id: number; kind: 'error' | 'success' | 'info'; msg: string };
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toastIdRef = React.useRef(0);
  const showToast = React.useCallback((msg: string, kind: Toast['kind'] = 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, kind, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  // show toast on API error
  const prevError = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (state.error && state.error !== prevError.current) {
      showToast(state.error, 'error');
    }
    prevError.current = state.error;
  }, [state.error, showToast]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setStatusbarNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const statusbarDateTime = statusbarNow.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={`monitor-app${kioskMode ? ' monitor-kiosk-shell' : ''}`} data-theme={darkMode ? 'dark' : 'light'}>
      <div className="app-gradient-bg" aria-hidden="true" />
      <div className="monitor-tech-grid" aria-hidden="true" />
      <div className="monitor-tech-scanline" aria-hidden="true" />
      <div className="monitor-tech-orb monitor-tech-orb-a" aria-hidden="true" />
      <div className="monitor-tech-orb monitor-tech-orb-b" aria-hidden="true" />

      <header className="titlebar">
        <div className="brand">
          <div className="brand-logo brand-logo-tech">
            <span className="brand-logo-ring" aria-hidden="true" />
            <UiIcon icon={Zap} size="md" fill="currentColor" />
          </div>
          <div className="brand-name">
            EnergyLink <span>Monitor</span>
          </div>
        </div>
        <div className="titlebar-actions">
          <label className="operator-role-select" title="Write-back role for tag controls">
            <span className="sr-only">Operator role</span>
            <select
              value={operatorRole}
              onChange={(e) => {
                const role = e.target.value as OperatorRole;
                setOperatorRole(role);
                setOperatorRoleState(role);
              }}
            >
              {OPERATOR_ROLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </label>
          <NotificationCenter
            alarms={state.alarms}
            unacknowledged={state.alarmSummary?.unacknowledged ?? 0}
            connStatus={connStatus}
            engineError={state.error}
            onAcknowledge={id => void ackAlarm(id)}
            onViewAlarms={() => setState(cur => ({ ...cur, activeView: 'alarm' }))}
          />
          <button
            type="button"
            className="dark-mode-btn"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark mode"
          >
            <UiIcon icon={darkMode ? Sun : Moon} size="sm" />
          </button>
          <button
            type="button"
            className="titlebar-icon-btn hamburger-btn"
            onClick={() => setMobileNavOpen(o => !o)}
            title="Toggle navigation"
            aria-label="Toggle navigation panel"
          >
            <UiIcon icon={mobileNavOpen ? X : Menu} size="sm" />
          </button>
          <button
            type="button"
            className="titlebar-icon-btn"
            onClick={() => setThemeOpen(true)}
            title="Theme"
            aria-label="Open theme customization"
          >
            <UiIcon icon={Palette} size="sm" />
          </button>
          <form className="engine-url" onSubmit={handleEngineUrl} title="Engine API connection">
            <label className="sr-only" htmlFor="engine-url-input">Engine API</label>
            <input
              id="engine-url-input"
              name="engineUrl"
              defaultValue={state.engineUrl}
              placeholder="Engine URL"
              aria-label="Engine API URL"
            />
            <button type="submit" title="Connect to engine">
              <Plug size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="engine-connect-label">Connect</span>
            </button>
          </form>
        </div>
      </header>

      <MonitorNavBar
        navItems={NAV_ITEMS}
        activeView={state.activeView}
        onNavigate={key => setState(cur => ({ ...cur, activeView: key as ViewKey }))}
        isPolling={state.pollingStatus?.running}
        refreshSeconds={state.refreshSeconds}
        loading={state.loading}
        onRefresh={() => void refresh({ showLoading: true })}
        onStart={() => void startPolling()}
        onStop={() => void stopPolling()}
        onRefreshSeconds={seconds => setState(cur => ({ ...cur, refreshSeconds: seconds }))}
      />

      {mobileNavOpen && <div className="mobile-overlay" onClick={() => setMobileNavOpen(false)} />}
      <div className={`body${navPanelOpen ? '' : ' nav-collapsed'}`}>
        <aside className={`left-panel${navPanelOpen ? '' : ' collapsed'}${mobileNavOpen ? ' force-open' : ''}`} aria-hidden={!navPanelOpen && !mobileNavOpen}>
          <div className="panel-title">
            <span>Navigation</span>
            {activeAlarms > 0 && (
              <span className="nav-alarm-badge" title={`${activeAlarms} active alarm(s)`}>
                {activeAlarms > 99 ? '99+' : activeAlarms}
              </span>
            )}
            <button
              type="button"
              className="nav-panel-toggle"
              onClick={() => { setNavPanelOpen(false); setMobileNavOpen(false); }}
              aria-label="Collapse navigation panel"
              title="Hide sidebar"
            >
              <UiIcon icon={ChevronLeft} size="sm" />
            </button>
          </div>
          <div className="panel-scroll">
            <div className="panel-section-title panel-section-title-tight">Graphics</div>
            {state.graphics.length === 0 ? (
              <div className="empty-small">No graphics yet.</div>
            ) : (
              state.graphics.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={`tree-item ${state.activeGraphicId === g.id ? 'active' : ''}`}
                  onClick={() => {
                    setState(cur => ({ ...cur, activeView: 'graphics', activeGraphicId: g.id }));
                    void refreshGraphic(g.id);
                  }}
                >
                  <span className="tree-item-icon">
                    <UiIcon icon={MonitorPlay} size="sm" />
                  </span>
                  {g.name}
                  {g.isDefault && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--amber)' }}>Default</span>
                  )}
                </button>
              ))
            )}
            <SidebarDeviceTree
              devices={state.devices}
              indexes={runtimeIndexes}
              search={sidebarSearch}
              onSearchChange={setSidebarSearch}
              onSelectDevice={id => setState(cur => ({ ...cur, activeView: 'devices', selectedDeviceId: id }))}
            />
          </div>
        </aside>

        {!navPanelOpen && (
          <button
            type="button"
            className="nav-panel-expand-tab"
            onClick={() => setNavPanelOpen(true)}
            aria-label="Show navigation panel"
            title="Show sidebar"
          >
            <UiIcon icon={ChevronRight} size="sm" />
            <span>Nav</span>
          </button>
        )}

        <main className="main-view">

          {state.activeView === 'dashboard' && (
            <DashboardView
              state={state}
              indexes={runtimeIndexes}
              rootCount={runtimeIndexes.roots.length}
              childCount={state.devices.length - runtimeIndexes.roots.length}
              tagCount={tags.length}
              connStatus={connStatus}
              onWriteTag={handleWriteTag}
              onAcknowledge={id => void ackAlarm(id)}
              onSelectDevice={id => setState(cur => ({ ...cur, activeView: 'devices', selectedDeviceId: id }))}
              onOpenDevices={() => setState(cur => ({ ...cur, activeView: 'devices', selectedDeviceId: undefined }))}
            />
          )}
          {state.activeView === 'graphics' && (
            <GraphicsView
              runtimeGraphic={state.runtimeGraphic}
              graphicsList={state.graphics}
              graphicsStatus={state.graphicsStatus}
              currentValues={state.currentValues}
              alarms={state.alarms}
              onWriteTag={handleWriteTag}
              onNavigateGraphic={(graphicId) => {
                setState(cur => ({ ...cur, activeGraphicId: graphicId }));
                void refreshGraphic(graphicId);
              }}
              onAcknowledge={(id) => void ackAlarm(id)}
            />
          )}
          {state.activeView === 'trend' && (
            <TrendAnalysis devices={state.devices} currentValues={state.currentValues} indexes={runtimeIndexes} />
          )}
          {state.activeView === 'alarm' && (
            <AlarmView alarms={state.alarms} summary={state.alarmSummary} onAcknowledge={id => void ackAlarm(id)} />
          )}
          {state.activeView === 'report' && (
            <ReportView
              reports={state.reports}
              generatedReports={state.generatedReports}
              message={state.reportActionMessage}
              onGenerate={generateReport}
              engineUrl={state.engineUrl}
            />
          )}
          {state.activeView === 'devices' &&
            (state.selectedDeviceId ? (
              <DeviceDetailsView
                device={state.devices.find(d => d.id === state.selectedDeviceId)}
                currentValues={state.currentValues}
                indexes={runtimeIndexes}
                onBack={() => setState(cur => ({ ...cur, selectedDeviceId: undefined }))}
                onWriteTag={handleWriteTag}
              />
            ) : (
              <DeviceManagementView
                devices={state.devices}
                indexes={runtimeIndexes}
                selectedDeviceId={state.selectedDeviceId}
                onSelectDevice={id => setState(cur => ({ ...cur, selectedDeviceId: id }))}
              />
            ))}
        </main>
      </div>

      <footer className="statusbar">
        <div className="statusbar-left">
          <span className="statusbar-datetime">{statusbarDateTime}</span>
          {state.lastRefresh && (
            <>
              <span className="statusbar-sep">|</span>
              <span className="statusbar-updated">Sync {state.lastRefresh}</span>
            </>
          )}
        </div>
        <div className="statusbar-metrics">
          <span>
            Engine: <StatusBadge status={connStatus} label={connStatus} />
          </span>
          <span className="statusbar-sep">|</span>
          <span>Live: {state.pollingStatus?.running ? 'On' : 'Off'}</span>
          <span className="statusbar-sep">|</span>
          <span>Devices: {state.devices.length}</span>
          <span className="statusbar-sep">|</span>
          <span>Tags: {tags.length}</span>
          <span className="statusbar-sep">|</span>
          <span>Alarms: {activeAlarms} Active</span>
        </div>
      </footer>

      <ThemeCustomizer open={themeOpen} onClose={() => setThemeOpen(false)} />

      {/* ── Toast container ───────────────────────────────────────────── */}
      <div className="monitor-toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`monitor-toast monitor-toast-${t.kind}`}>
            <span>{t.kind === 'error' ? '⚠' : t.kind === 'success' ? '✓' : 'ℹ'}</span>
            <span style={{ flex: 1 }}>{t.msg}</span>
            <button
              type="button"
              className="monitor-toast-close"
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              aria-label="Dismiss"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
