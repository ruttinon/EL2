import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Zap, LayoutDashboard, MonitorPlay, TrendingUp,
  BellRing, FileBarChart2, Cpu, RefreshCw, Play,
  Square, Activity, Download, Menu, X, Settings,
  ShieldCheck, ShieldAlert, Tag, Server, CheckCircle2,
  AlertTriangle, Search, Filter,
} from 'lucide-react';
import { engineApi } from './api/engineApi';
import { getEngineUrl, setEngineUrl } from './api/engineConnectionApi';
import {
  getOperatorRole,
  setOperatorRole,
  initOperatorRoleFromQuery,
  OPERATOR_ROLE_OPTIONS,
  type OperatorRole,
} from '@energylink/shared-ui';
import { SvgGauge, GraphicNavigationBar, useGraphicNavigation, collectFloorLevels, HtmlGraphicComposite } from '@energylink/graphics-runtime';
import { RuntimeGraphicViewport } from '@energylink/unified-viewport';
import { isHtmlGraphicPage } from '@energylink/shared-types';
import '@energylink/unified-viewport/src/unified-viewport.css';
import { qualityLabel, StatusBadge } from './components/StatusBadge';
import type {
  AlarmsResponse, ApiStatus, CurrentTagValue, CurrentValuesResponse,
  GeneratedReportFile, GraphicObject, GraphicSummary, ReportSummary,
  RuntimeDevice, RuntimeGraphicResponse, RuntimePollingStatus, TrendPoint, TrendResponse,
} from './types/webViewer';
import type { GraphicLayout } from '@energylink/shared-types';
import './styles/web-viewer.css';

/* ── Responsive hook ─────────────────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return w;
}

type ViewKey = 'dashboard' | 'graphics' | 'trend' | 'alarm' | 'report' | 'devices';

const MENUS: Array<{ key: ViewKey; label: string; icon: React.ReactNode; shortLabel: string }> = [
  { key: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: <LayoutDashboard size={20} /> },
  { key: 'graphics', label: 'Graphics', shortLabel: 'Graphics', icon: <MonitorPlay size={20} /> },
  { key: 'trend', label: 'Trend', shortLabel: 'Trend', icon: <TrendingUp size={20} /> },
  { key: 'alarm', label: 'Alarm', shortLabel: 'Alarm', icon: <BellRing size={20} /> },
  { key: 'report', label: 'Report', shortLabel: 'Report', icon: <FileBarChart2 size={20} /> },
  { key: 'devices', label: 'Device Status', shortLabel: 'Devices', icon: <Cpu size={20} /> },
];

function fmtDate(v?: string | null) {
  if (!v) return '--';
  try { return new Date(v).toLocaleString(); } catch { return v; }
}
function fmtVal(v: CurrentTagValue) {
  if (v.value === null || v.value === undefined) return '--';
  const d = Number.isFinite(v.decimalPlaces) ? Number(v.decimalPlaces) : 2;
  return `${Number(v.value).toFixed(d)}${v.unit ? ` ${v.unit}` : ''}`;
}

/* ── SVG Trend Chart (Trend view page) ────────────────────────── */
function SvgTrendChart({ data, tagName, unit }: { data: TrendResponse; tagName?: string; unit?: string }) {
  const pts = data.values.filter(v => v.value != null);
  if (pts.length === 0) {
    return <div className="empty"><p>No history data is available for this tag.</p></div>;
  }
  const W = 900; const H = 260;
  const PAD = { top: 20, right: 20, bottom: 40, left: 56 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const vals = pts.map(p => p.value as number);
  const times = pts.map(p => new Date(p.readAt).getTime());
  const minV = Math.min(...vals); const maxV = Math.max(...vals);
  const vRange = maxV - minV || 1;
  const tRange = (times[times.length - 1] ?? 0) - (times[0] ?? 0) || 1;

  const sx = (t: number) => PAD.left + ((t - (times[0] ?? 0)) / tRange) * cW;
  const sy = (v: number) => PAD.top + cH - ((v - minV) / vRange) * cH;

  const polyPts = pts.map(p => `${sx(new Date(p.readAt).getTime()).toFixed(1)},${sy(p.value as number).toFixed(1)}`).join(' ');
  const fillPts = `${PAD.left},${PAD.top + cH} ${polyPts} ${sx(times[times.length - 1]!)},${PAD.top + cH}`;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const yTicks = [0, .25, .5, .75, 1].map(t => ({ v: minV + t * vRange, y: PAD.top + cH - t * cH }));
  const step = Math.ceil(pts.length / 6);
  const xLabels = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

  return (
    <div>
      <div className="trend-meta">
        <div className="trend-meta-item"><span>Tag:</span><b>{tagName ?? data.tagId}</b></div>
        <div className="trend-meta-item"><span>Points:</span><b>{data.count}</b></div>
        <div className="trend-meta-item"><span>Min:</span><b>{Math.min(...vals).toFixed(2)} {unit}</b></div>
        <div className="trend-meta-item"><span>Max:</span><b>{Math.max(...vals).toFixed(2)} {unit}</b></div>
        <div className="trend-meta-item"><span>Avg:</span><b>{avg.toFixed(2)} {unit}</b></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart-svg" preserveAspectRatio="none">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#e2edf2" strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{t.v.toFixed(1)}</text>
          </g>
        ))}
        <polygon points={fillPts} fill="#087c8b" opacity="0.08" />
        <polyline points={polyPts} fill="none" stroke="#087c8b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={PAD.left} y1={sy(avg)} x2={W - PAD.right} y2={sy(avg)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="5,3" />
        {xLabels.map((p, i) => (
          <text key={i} x={sx(new Date(p.readAt).getTime())} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {new Date(p.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}
        {pts.length > 0 && (
          <circle cx={sx(times[times.length - 1]!)} cy={sy(vals[vals.length - 1]!)} r="4" fill="#087c8b" stroke="#fff" strokeWidth="2" />
        )}
      </svg>
    </div>
  );
}

/* ── Main App ──────────────────────────────── */
export default function App() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [runtime, setRuntime] = useState<RuntimePollingStatus | null>(null);
  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [current, setCurrent] = useState<CurrentValuesResponse | null>(null);
  const [alarms, setAlarms] = useState<AlarmsResponse | null>(null);
  const [graphics, setGraphics] = useState<GraphicSummary[]>([]);
  const [selectedGraphicId, setSelectedGraphicId] = useState('');
  const [graphicRuntime, setGraphicRuntime] = useState<RuntimeGraphicResponse | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReportFile[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [engineUrlDraft, setEngineUrlDraft] = useState(getEngineUrl());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const kioskMode = useMemo(() => new URLSearchParams(window.location.search).get('kiosk') === '1', []);
  const [operatorRole, setOperatorRoleState] = useState<OperatorRole>(() => getOperatorRole());

  useEffect(() => {
    initOperatorRoleFromQuery();
    setOperatorRoleState(getOperatorRole());
  }, []);

  useEffect(() => {
    if (!kioskMode) return undefined;
    document.body.classList.add('kiosk-mode');
    setView('graphics');
    void engineApi.getDefaultGraphic().then((r) => {
      if (r.ok && r.data?.graphic) {
        setSelectedGraphicId(r.data.graphic.id);
        setGraphicRuntime(r.data);
      }
    });
    return () => { document.body.classList.remove('kiosk-mode'); };
  }, [kioskMode]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sRes, rRes, dRes, cRes, aRes, gRes, rpRes, grRes] = await Promise.all([
      engineApi.getStatus(), engineApi.getRuntimeStatus(), engineApi.getDevices(),
      engineApi.getCurrentValues(), engineApi.getAlarms(), engineApi.getGraphics(),
      engineApi.getReports(), engineApi.getGeneratedReports(),
    ]);
    if (sRes.ok) setStatus(sRes.data);
    if (rRes.ok) setRuntime(rRes.data);
    if (dRes.ok) setDevices(dRes.data);
    if (cRes.ok) { setCurrent(cRes.data); if (!rRes.ok && cRes.data.runtime) setRuntime(cRes.data.runtime); }
    if (aRes.ok) setAlarms(aRes.data);
    if (gRes.ok) { setGraphics(gRes.data); setSelectedGraphicId(e => e || gRes.data[0]?.id || ''); }
    if (rpRes.ok) setReports(rpRes.data);
    if (grRes.ok) setGeneratedReports(grRes.data.files ?? []);
    const firstTag = cRes.ok ? cRes.data.values[0]?.id : undefined;
    setSelectedTagId(e => e || firstTag || '');
    const fails = [sRes, rRes, dRes, cRes, aRes, gRes, rpRes, grRes].filter(r => !r.ok);
    setMsg(fails.length > 0 && !sRes.ok ? (fails[0].message || 'Engine is not ready') : '');
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = window.setInterval(refresh, 10000);
    return () => window.clearInterval(t);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    if (!selectedGraphicId) { setGraphicRuntime(null); return; }
    engineApi.getGraphic(selectedGraphicId).then(r => {
      if (r.ok) setGraphicRuntime(r.data);
      else { setGraphicRuntime(null); setMsg(r.message); }
    });
  }, [selectedGraphicId]);

  useEffect(() => {
    if (!selectedTagId) { setTrend(null); return; }
    engineApi.getTrend(selectedTagId).then(r => {
      if (r.ok) setTrend(r.data); else { setTrend(null); setMsg(r.message); }
    });
  }, [selectedTagId]);

  const valuesByTag = useMemo(() => new Map((current?.values ?? []).map(v => [v.id, v])), [current]);
  const allTags = current?.values ?? [];
  const onlineDevices = devices.filter(d => String(d.status ?? '').toLowerCase().includes('online')).length;
  const activeAlarms = alarms?.summary?.active ?? 0;
  const goodVals = allTags.filter(t => t.quality === 'good').length;

  async function applyUrl() {
    const url = engineUrlDraft.trim().replace(/\/$/, '');
    if (!url) return;
    setEngineUrl(url);
    setMsg(`Connecting to ${url}...`);
    await refresh();
  }

  async function runPolling(action: 'start' | 'stop' | 'read') {
    setMsg(action === 'start' ? 'Starting...' : action === 'stop' ? 'Stopping...' : 'Reading...');
    const r = action === 'start' ? await engineApi.startPolling()
      : action === 'stop' ? await engineApi.stopPolling()
        : await engineApi.runReadCycle();
    if (!r.ok) { setMsg(r.message); return; }
    setMsg(action === 'read' ? 'Read cycle done.' : 'Command sent.');
    await refresh();
  }

  async function ackAlarm(id: string) {
    const r = await engineApi.acknowledgeAlarm(id);
    if (!r.ok) { setMsg(r.message); return; }
    setMsg('Alarm acknowledged.');
    await refresh();
  }

  async function handleWriteTag(
    tagId: string,
    tagName: string,
    dataType: string,
    options?: { presetValue?: number | boolean; requireConfirm?: boolean },
  ) {
    const role = sessionStorage.getItem('energylink.operatorRole') || 'operator';
    if (role === 'viewer') {
      alert('Write denied: viewer role. Open with ?role=operator to enable writes.');
      return;
    }
    const isBool = dataType === 'bool';
    let value: number | boolean;
    if (options?.presetValue !== undefined) {
      value = options.presetValue;
    } else {
      const promptMsg = isBool
        ? `Enter new value for "${tagName}" (1 = True, 0 = False):`
        : `Enter new value for "${tagName}":`;
      const input = window.prompt(promptMsg);
      if (input === null || input.trim() === '') return;
      if (isBool) {
        const clean = input.trim().toLowerCase();
        if (clean === '1' || clean === 'true' || clean === 't' || clean === 'y') value = true;
        else if (clean === '0' || clean === 'false' || clean === 'f' || clean === 'n') value = false;
        else { alert('Invalid boolean value.'); return; }
      } else {
        value = Number(input);
        if (isNaN(value)) { alert('Invalid number.'); return; }
      }
    }
    if (options?.requireConfirm && !window.confirm(`Write ${String(value)} to "${tagName}"?`)) return;
    setLoading(true);
    const r = await engineApi.writeTag(tagId, value);
    if (r.ok) await refresh();
    else alert(`Write failed: ${r.message || 'Unknown error'}`);
    setLoading(false);
  }

  async function genReport(id: string, fmt: 'pdf' | 'excel') {
    setMsg(`Generating ${fmt.toUpperCase()}...`);
    const r = await engineApi.generateReport(id, fmt);
    if (!r.ok) { setMsg(r.message); return; }
    const gr = await engineApi.getGeneratedReports();
    if (gr.ok) setGeneratedReports(gr.data.files ?? []);
    setMsg('Report generated.');
  }

  const selectedTag = allTags.find(v => v.id === selectedTagId);

  const winWidth = useWindowWidth();
  const isMobile = winWidth <= 600;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [urlPanelOpen, setUrlPanelOpen] = useState(false);

  // Close drawer when switching views on mobile
  const handleSetView = (v: ViewKey) => { setView(v); setDrawerOpen(false); };

  if (kioskMode) {
    return (
      <div className="kiosk-shell">
        <GraphicsView
          graphics={graphics}
          selectedId={selectedGraphicId}
          onSelect={setSelectedGraphicId}
          graphicRuntime={graphicRuntime}
          current={current}
          alarms={alarms}
          onWriteTag={handleWriteTag}
          onAcknowledge={ackAlarm}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        {isMobile && (
          <button
            onClick={() => setDrawerOpen(o => !o)}
            style={{ border: 0, background: 'transparent', color: '#fff', padding: '4px 6px', marginRight: 2 }}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        )}
        <div className="brand">
          <div className="brand-mark"><Zap size={18} color="#087c8b" /></div>
          <div className="brand-name">EnergyLink <small>Web Viewer</small></div>
        </div>
        <div className="top-meta">
          <label className="operator-role-select top-chip" title="Write-back role">
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
          <span className="top-chip hide-mobile">{getEngineUrl()}</span>
          {isMobile ? (
            <button
              onClick={() => setUrlPanelOpen(o => !o)}
              style={{ border: 0, background: 'rgba(255,255,255,.15)', borderRadius: 7, color: '#fff', padding: '5px 8px' }}
              aria-label="Engine settings"
            >
              <Settings size={16} />
            </button>
          ) : (
            <span className="top-chip">Local Open Access</span>
          )}
        </div>
      </header>

      {/* Engine URL panel (mobile dropdown) */}
      <div className={`url-panel${urlPanelOpen ? ' open' : ''}`}>
        <input
          value={engineUrlDraft}
          onChange={e => setEngineUrlDraft(e.target.value)}
          placeholder="Engine URL"
        />
        <button className="btn primary" style={{ height: 36, padding: '0 12px' }} onClick={() => { applyUrl(); setUrlPanelOpen(false); }}>Apply</button>
        <button onClick={() => setUrlPanelOpen(false)} style={{ border: 0, background: 'transparent', color: 'var(--muted)', padding: 6 }}><X size={18} /></button>
      </div>

      {/* Mobile Drawer */}
      <div className={`drawer-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`drawer${drawerOpen ? ' open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-title">EnergyLink</span>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>×</button>
        </div>
        <div className="drawer-body">
          {MENUS.map(m => (
            <button
              key={m.key}
              className={`side-list-btn${view === m.key ? ' active' : ''}`}
              onClick={() => handleSetView(m.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              {m.icon}
              {m.label}
              {m.key === 'alarm' && activeAlarms > 0 && (
                <span className="badge bad" style={{ marginLeft: 'auto', fontSize: 10 }}>{activeAlarms}</span>
              )}
            </button>
          ))}

          {/* Graphics list in drawer if Graphics view is active */}
          {view === 'graphics' && graphics.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px 6px', background: '#f8fafc' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Graphics</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {graphics.map((g: GraphicSummary) => (
                  <button
                    key={g.id}
                    className={`side-list-btn${selectedGraphicId === g.id ? ' active' : ''}`}
                    onClick={() => { setSelectedGraphicId(g.id); setDrawerOpen(false); }}
                    style={{ padding: '6px 8px', fontSize: 12, textAlign: 'left', width: '100%' }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trend tags in drawer if Trend view is active */}
          {view === 'trend' && allTags.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px 6px', background: '#f8fafc' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Trend Tags</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                {allTags.map((t: CurrentTagValue) => (
                  <button
                    key={t.id}
                    className={`side-list-btn${selectedTagId === t.id ? ' active' : ''}`}
                    onClick={() => { setSelectedTagId(t.id); setDrawerOpen(false); }}
                    style={{ padding: '6px 8px', fontSize: 12, textAlign: 'left', width: '100%' }}
                  >
                    <span style={{ fontWeight: 700 }}>{t.name}</span> <span style={{ fontSize: 10, color: 'var(--muted)' }}>({t.deviceName})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Engine</div>
          <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--muted)' }}>{getEngineUrl()}</div>
          <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6, flexDirection: 'column' }}>
            <button className="btn primary" style={{ width: '100%' }} onClick={() => { refresh(); setDrawerOpen(false); }}>Refresh Data</button>
            <button className="btn" style={{ width: '100%' }} onClick={() => { runPolling('start'); setDrawerOpen(false); }}>Start Polling</button>
            <button className="btn" style={{ width: '100%' }} onClick={() => { runPolling('stop'); setDrawerOpen(false); }}>Stop Polling</button>
          </div>
        </div>
      </div>

      {/* Desktop Menubar */}
      <nav className="menubar">
        {MENUS.map(m => (
          <button key={m.key} className={view === m.key ? 'active' : ''} onClick={() => setView(m.key)}>
            {m.label}
            {m.key === 'alarm' && activeAlarms > 0 && <span className="badge bad" style={{ marginLeft: 6, fontSize: 10 }}>{activeAlarms}</span>}
          </button>
        ))}
      </nav>

      {/* Desktop Toolbar */}
      <div className="toolbar">
        <button className="btn primary" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <button className="btn" onClick={() => setAutoRefresh(v => !v)}>{autoRefresh ? 'Auto ON' : 'Auto OFF'}</button>
        {!isMobile && (
          <>
            <button className="btn" onClick={() => runPolling('start')}><Play size={13} />Start Polling</button>
            <button className="btn" onClick={() => runPolling('stop')}><Square size={13} />Stop Polling</button>
            <button className="btn" onClick={() => runPolling('read')}><Activity size={13} />Read Once</button>
          </>
        )}
        <span className="toolbar-muted">Engine: <StatusBadge value={runtime?.running ? 'running' : status?.status ?? 'offline'} /></span>
        {msg && <span className="toolbar-msg">{msg}</span>}
        {!isMobile && (
          <div className="toolbar-engine-url">
            <input value={engineUrlDraft} onChange={e => setEngineUrlDraft(e.target.value)} placeholder="Engine URL" />
            <button className="btn primary" style={{ height: 32, padding: '0 10px' }} onClick={applyUrl}>Apply</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="content">
        {view === 'dashboard' && <DashboardView allTags={allTags} devices={devices} onlineDevices={onlineDevices} goodVals={goodVals} activeAlarms={activeAlarms} reports={reports} runtime={runtime} alarms={alarms} onWriteTag={handleWriteTag} />}
        {view === 'graphics' && <GraphicsView graphics={graphics} selectedId={selectedGraphicId} onSelect={setSelectedGraphicId} graphicRuntime={graphicRuntime} current={current} alarms={alarms} onWriteTag={handleWriteTag} onAcknowledge={ackAlarm} />}
        {view === 'trend' && <TrendView allTags={allTags} selectedTagId={selectedTagId} onSelect={setSelectedTagId} trend={trend} selectedTag={selectedTag} isMobile={isMobile} />}
        {view === 'alarm' && <AlarmView alarms={alarms} onAck={ackAlarm} />}
        {view === 'report' && <ReportView reports={reports} generatedReports={generatedReports} onGenerate={genReport} />}
        {view === 'devices' && <DeviceView devices={devices} />}
      </div>

      {/* Statusbar (desktop only) */}
      <footer className="statusbar">
        <span>Engine: {status?.status ?? '--'}</span>
        <span>DB: {status?.databaseExists ? 'Ready' : 'N/A'}</span>
        <span>Alarms: {activeAlarms} Active</span>
        <span>Runtime values: real reads only</span>
      </footer>

      {/* Bottom Navigation (mobile only) */}
      <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
        <div className="bottom-nav-inner">
          {MENUS.map(m => (
            <button
              key={m.key}
              className={`bottom-nav-btn${view === m.key ? ' active' : ''}`}
              onClick={() => setView(m.key)}
            >
              {m.icon}
              {m.shortLabel}
              {m.key === 'alarm' && activeAlarms > 0 && (
                <span className="bottom-nav-badge">{activeAlarms}</span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────── */
function DashboardView({ allTags, devices, onlineDevices, goodVals, activeAlarms, reports, runtime, alarms, onWriteTag }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [dashTrendTagId, setDashTrendTagId] = useState('');
  const [dashTrend, setDashTrend] = useState<TrendResponse | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' | ' +
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredTags = useMemo(() => {
    return allTags.filter((t: any) => {
      const matchesSearch = searchQuery === '' ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.deviceName && t.deviceName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDevice = deviceFilter === '' || t.deviceId === deviceFilter;
      return matchesSearch && matchesDevice;
    });
  }, [allTags, searchQuery, deviceFilter]);

  const uniqueDevices = useMemo(() => {
    const map = new Map();
    allTags.forEach((t: any) => {
      if (t.deviceId && t.deviceName) {
        map.set(t.deviceId, t.deviceName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTags]);

  const activeAlarmList = (alarms?.alarms ?? []).filter((a: any) => a.status === 'active' || a.severity === 'high');

  // Default selection to first numeric tag (preferably Current I1)
  useEffect(() => {
    const numericTags = allTags.filter((t: any) => t.value !== null && t.value !== undefined && !isNaN(Number(t.value)));
    if (numericTags.length > 0 && !dashTrendTagId) {
      const current1 = numericTags.find((t: any) => t.name.toLowerCase().includes('i1') || t.name.toLowerCase().includes('current 1'));
      setDashTrendTagId(current1?.id || numericTags[0].id);
    }
  }, [allTags, dashTrendTagId]);

  // Fetch trend data whenever selection or tags list updates (auto-refresh cycle)
  useEffect(() => {
    if (!dashTrendTagId) return;
    engineApi.getTrend(dashTrendTagId).then(r => {
      if (r.ok) setDashTrend(r.data);
    });
  }, [dashTrendTagId, allTags]);

  const tagI1 = useMemo(() => allTags.find((t: any) => t.name.toLowerCase().includes('i1') || t.name.toLowerCase().includes('current 1') || t.id.toLowerCase().includes('i1')), [allTags]);
  const tagI2 = useMemo(() => allTags.find((t: any) => t.name.toLowerCase().includes('i2') || t.name.toLowerCase().includes('current 2') || t.id.toLowerCase().includes('i2')), [allTags]);
  const tagI3 = useMemo(() => allTags.find((t: any) => t.name.toLowerCase().includes('i3') || t.name.toLowerCase().includes('current 3') || t.id.toLowerCase().includes('i3')), [allTags]);
  const tagFreq = useMemo(() => allTags.find((t: any) => t.name.toLowerCase().includes('freq') || t.id.toLowerCase().includes('freq')), [allTags]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Welcome banner */}
      <div className="dashboard-welcome">
        <div className="welcome-text">
          <h1>EnergyLink Management Dashboard</h1>
          <p>Real-time SCADA System Monitoring & Control Panel</p>
        </div>
        <div className="welcome-clock">
          <Activity size={15} className="pulse-icon green" style={{ marginRight: 6, verticalAlign: 'middle' }} />
          <span>{timeStr || '--:--:--'}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics">
        <MetricCard label="Devices" value={devices.length} cls="blue" icon={<Cpu size={22} />} />
        <MetricCard label="Online" value={onlineDevices} cls={onlineDevices > 0 ? 'green' : 'red'} icon={<Server size={22} />} />
        <MetricCard label="Tags" value={allTags.length} cls="purple" icon={<Tag size={22} />} />
        <MetricCard label="Valid Quality" value={goodVals} cls={goodVals === allTags.length && allTags.length > 0 ? 'green' : 'amber'} icon={<ShieldCheck size={22} />} />
        <MetricCard label="Active Alarms" value={activeAlarms} cls={activeAlarms > 0 ? 'red' : 'green'} icon={activeAlarms > 0 ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />} />
        <MetricCard label="Reports" value={reports.length} cls="amber" icon={<FileBarChart2 size={22} />} />
      </div>

      {/* Real-time Telemetry Analytics */}
      <div className="card dashboard-analytics-card">
        <div className="card-header-styled">
          <div className="header-title-block">
            <TrendingUp size={18} className="pulse-icon green" style={{ marginRight: 4, verticalAlign: 'middle' }} />
            <h2>Real-time Telemetry Analytics</h2>
            <span className="chip">Live Diagnostics</span>
          </div>
          
          {/* Trend selector */}
          <div className="filter-select-wrapper" style={{ width: 'auto' }}>
            <Filter size={13} className="filter-icon" />
            <select 
              value={dashTrendTagId} 
              onChange={e => setDashTrendTagId(e.target.value)}
              className="filter-select"
              style={{ width: '220px', paddingLeft: '30px' }}
            >
              <option value="">Select Trend Tag</option>
              {allTags.filter((t: any) => t.value !== null && t.value !== undefined && !isNaN(Number(t.value))).map((t: any) => (
                <option key={t.id} value={t.id}>{t.deviceName} - {t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="analytics-body-grid">
          {/* Trend Chart */}
          <div className="analytics-chart-panel">
            {dashTrend && dashTrend.count > 0 ? (
              <SvgTrendChart 
                data={dashTrend} 
                tagName={allTags.find((t: any) => t.id === dashTrendTagId)?.name} 
                unit={allTags.find((t: any) => t.id === dashTrendTagId)?.unit ?? ''} 
              />
            ) : (
              <div className="empty" style={{ minHeight: '200px' }}>
                <TrendingUp size={32} color="#9fc4cc" />
                <p>Loading real-time trend data...</p>
              </div>
            )}
          </div>

          {/* Gauges Panel */}
          <div className="analytics-gauges-panel">
            <h3>System Load Telemetry</h3>
            <div className="gauges-flex-row">
              <div className="gauge-item-container">
                <span className="gauge-item-title">Current I1</span>
                <SvgGauge value={tagI1?.value} min={0} max={100} unit="A" />
              </div>
              <div className="gauge-item-container">
                <span className="gauge-item-title">Current I2</span>
                <SvgGauge value={tagI2?.value} min={0} max={100} unit="A" />
              </div>
              <div className="gauge-item-container">
                <span className="gauge-item-title">Current I3</span>
                <SvgGauge value={tagI3?.value} min={0} max={100} unit="A" />
              </div>
              <div className="gauge-item-container">
                <span className="gauge-item-title">Frequency</span>
                <SvgGauge value={tagFreq?.value} min={45} max={55} unit="Hz" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Current Values Card */}
        <div className="card">
          <div className="card-header-styled">
            <div className="header-title-block">
              <h2>Current Values</h2>
              <span className="chip">{filteredTags.length} / {allTags.length} Tags</span>
            </div>
            
            {/* Search & Filter controls */}
            <div className="search-filter-row">
              <div className="search-input-wrapper">
                <Search size={13} className="search-icon" />
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="Search tags..."
                  className="search-input"
                />
              </div>
              <div className="filter-select-wrapper">
                <Filter size={13} className="filter-icon" />
                <select 
                  value={deviceFilter} 
                  onChange={e => setDeviceFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Devices</option>
                  {uniqueDevices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="tbl-wrap" style={{ maxHeight: '412px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Tag</th>
                  <th>Value</th>
                  <th>Quality</th>
                  <th>Last Read</th>
                  <th>Write</th>
                </tr>
              </thead>
              <tbody>
                {filteredTags.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                      No tag records match this criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTags.map((v: CurrentTagValue) => {
                    const isGood = v.quality === 'good';
                    const isWarn = v.quality === 'warn' || v.quality === 'uncertain';
                    const qCls = isGood ? 'good' : isWarn ? 'warn' : 'bad';
                    
                    return (
                      <tr key={v.id}>
                        <td>{v.deviceName}</td>
                        <td><b style={{ color: 'var(--teal-900)' }}>{v.name}</b></td>
                        <td>
                          <b style={{ fontSize: '15px' }}>
                            {v.value == null ? '--' : Number(v.value).toFixed(v.decimalPlaces ?? 2)}
                          </b>
                          {v.unit && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '3px' }}>{v.unit}</span>}
                        </td>
                        <td>
                          <div className="quality-cell">
                            <span className={`status-dot ${qCls}`} />
                            <span className={`badge ${qCls}`}>{qualityLabel(v.quality)}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {fmtDate(v.lastValueAt)}
                        </td>
                        <td>
                          {(v.registerType === 'coil' || v.registerType === 'holding_register') && (
                            <button
                              className="write-btn-styled"
                              onClick={() => onWriteTag(v.id, v.name, v.dataType)}
                            >
                              ✎ Write
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Alarms Card */}
        <div className="card">
          <div className="card-header">
            <h2>Active Alarms</h2>
            <span className="chip">{activeAlarms} Active</span>
          </div>
          
          <div className="alarms-feed-container" style={{ maxHeight: '412px', overflowY: 'auto', padding: '12px' }}>
            {activeAlarmList.length === 0 ? (
              <div className="empty-status-panel">
                <CheckCircle2 size={36} className="nominal-icon" />
                <h3>All Systems Nominal</h3>
                <p>System values are within nominal parameters. 0 active alarms detected.</p>
              </div>
            ) : (
              <div className="alarm-feed">
                {activeAlarmList.map((a: any) => {
                  const isHigh = a.severity === 'high' || a.severity === 'critical';
                  const isMed = a.severity === 'medium';
                  const cardCls = isHigh ? 'critical' : isMed ? 'warning' : 'info';
                  
                  return (
                    <div key={a.id} className={`alarm-feed-card ${cardCls}`}>
                      <div className="alarm-feed-card-header">
                        <div className="alarm-badge-wrapper">
                          <AlertTriangle size={12} />
                          <span className="alarm-severity">{a.severity}</span>
                        </div>
                        <span className="alarm-time">{new Date(a.startedAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="alarm-feed-body">
                        <h4>{a.deviceName}.{a.tagName}</h4>
                        <p>{a.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Polling & Diagnostics stats */}
      <div className="card">
        <div className="card-header"><h2>Diagnostic Engine Status</h2></div>
        <div className="diagnostic-row" style={{ display: 'flex', gap: 12, padding: '14px', flexWrap: 'wrap' }}>
          <div className="diagnostic-pill">
            <span className="pill-icon"><Activity className={runtime?.running ? 'green-spin' : ''} size={15} /></span>
            <div className="pill-text">
              <span className="pill-label">Engine Connection</span>
              <span className="pill-value">{runtime?.running ? 'Active' : 'Offline'}</span>
            </div>
          </div>
          <div className="diagnostic-pill">
            <span className="pill-icon"><CheckCircle2 size={15} style={{ color: 'var(--green)' }} /></span>
            <div className="pill-text">
              <span className="pill-label">Reads Succeeded</span>
              <span className="pill-value">{runtime?.successfulReads ?? 0} cycles</span>
            </div>
          </div>
          <div className="diagnostic-pill">
            <span className="pill-icon"><AlertTriangle size={15} style={{ color: (runtime?.failedReads ?? 0) > 0 ? 'var(--red)' : 'var(--muted)' }} /></span>
            <div className="pill-text">
              <span className="pill-label">Reads Failed</span>
              <span className="pill-value">{runtime?.failedReads ?? 0} cycles</span>
            </div>
          </div>
          <div className="diagnostic-pill">
            <span className="pill-icon"><RefreshCw size={15} /></span>
            <div className="pill-text">
              <span className="pill-label">Last Read Cycle</span>
              <span className="pill-value">{runtime?.lastCycleAt ? new Date(runtime.lastCycleAt).toLocaleTimeString() : '--'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Graphics View ─────────────────────────── */
function GraphicsView({ graphics, selectedId, onSelect, graphicRuntime, current, alarms, onWriteTag, onAcknowledge }: {
  graphics: GraphicSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  graphicRuntime: RuntimeGraphicResponse | null;
  current: CurrentValuesResponse | null;
  alarms: AlarmsResponse | null;
  onWriteTag: (tagId: string, tagName: string, dataType: string) => void;
  onAcknowledge?: (alarmId: string) => void;
}) {
  const [diagramMode, setDiagramMode] = useState(false);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [displayRuntime, setDisplayRuntime] = useState(graphicRuntime);
  const nav = useGraphicNavigation(selectedId);

  useEffect(() => {
    setDisplayRuntime(graphicRuntime);
    if (selectedId) nav.reset(selectedId);
    setActiveFloor(null);
  }, [selectedId, graphicRuntime?.graphic?.id]);

  useEffect(() => {
    if (!nav.currentId || nav.currentId === displayRuntime?.graphic?.id) return;
    void engineApi.getGraphic(nav.currentId).then((r) => {
      if (r.ok) setDisplayRuntime(r.data);
    });
  }, [nav.currentId, displayRuntime?.graphic?.id]);

  const stageW = displayRuntime?.graphic?.width || 1200;
  const stageH = displayRuntime?.graphic?.height || 768;
  const layout = displayRuntime?.graphic?.layout as GraphicLayout | undefined;
  const htmlPage = layout ? isHtmlGraphicPage(layout) : false;
  const objects = displayRuntime?.graphic?.layout?.objects ?? [];
  const floors = collectFloorLevels(objects);
  const stackLabels = nav.stack.map((id) => graphics.find((g) => g.id === id)?.name ?? id.slice(-6));

  return (
    <div className="viewer-layout" style={{ minHeight: 'calc(100vh - 220px)' }}>
      <div className="side-list">
        <div className="side-list-header">Graphics ({graphics.length})</div>
        {graphics.length === 0 && <div className="empty" style={{ minHeight: 120 }}><p>Create a graphic in Editor.</p></div>}
        {graphics.map((g: GraphicSummary) => (
          <button key={g.id} className={`side-list-btn ${selectedId === g.id ? 'active' : ''}`} onClick={() => onSelect(g.id)}>
            {g.name}
            {g.isDefault && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b' }}>★ Default</span>}
          </button>
        ))}
      </div>
      <div className="card graphic-card">
        {!displayRuntime
          ? <div className="empty"><MonitorPlay size={32} color="#9fc4cc" /><p>Select a graphic from the list.</p></div>
          : <>
            <div className="card-header">
              <h2>{displayRuntime.graphic.name}</h2>
              <span className="chip">{htmlPage ? `${objects.length} Overlay` : `${objects.length} Objects`}</span>
              <button
                type="button"
                className={`btn secondary tiny diagram-toggle${diagramMode ? ' active' : ''}`}
                onClick={() => setDiagramMode((v) => !v)}
              >
                Diagram
              </button>
            </div>
            {htmlPage && layout ? (
              <HtmlGraphicComposite
                layout={layout}
                width={stageW}
                height={stageH}
                objects={objects}
                currentValues={current?.values ?? []}
                onWriteTag={onWriteTag}
                interactive
                className="viewer-html-page"
                overlayStageProps={{
                  alarms: alarms?.alarms ?? [],
                  onNavigate: (gid) => nav.push(gid),
                  onAcknowledge,
                  fetchTrend: async (opts) => {
                    const r = await engineApi.getTrend(opts.tagId);
                    return r.ok ? r.data : null;
                  },
                  refreshIntervalMs: displayRuntime.graphic.refreshIntervalMs ?? 10000,
                  diagramMode,
                  wrapClassName: 'graphic-stage-wrap',
                  stageClassName: 'graphic-stage',
                  animate: false,
                  navigationBar: (
                    <GraphicNavigationBar
                      canGoBack={nav.canGoBack}
                      onBack={() => nav.pop()}
                      currentLabel={displayRuntime.graphic.name}
                      stackLabels={stackLabels}
                      floors={floors}
                      activeFloor={activeFloor}
                      onFloorChange={setActiveFloor}
                    />
                  ),
                }}
              />
            ) : (
            <RuntimeGraphicViewport
              width={stageW}
              height={stageH}
              layout={displayRuntime.graphic.layout as GraphicLayout}
              objects={objects}
              cameraPreset={(displayRuntime.graphic.layout as GraphicLayout).defaultCamera ?? 'flat'}
              activeFloor={activeFloor}
              backgroundColor={displayRuntime.graphic.layout.backgroundColor ?? '#fbfdff'}
              backgroundImage={displayRuntime.graphic.layout.backgroundImage}
              stageProps={{
                currentValues: current?.values ?? [],
                alarms: alarms?.alarms ?? [],
                onWriteTag,
                onNavigate: (gid) => nav.push(gid),
                onAcknowledge,
                fetchTrend: async (opts) => {
                  const r = await engineApi.getTrend(opts.tagId);
                  return r.ok ? r.data : null;
                },
                refreshIntervalMs: displayRuntime.graphic.refreshIntervalMs ?? 10000,
                diagramMode,
                wrapClassName: 'graphic-stage-wrap',
                stageClassName: 'graphic-stage',
                animate: false,
                navigationBar: (
                  <GraphicNavigationBar
                    canGoBack={nav.canGoBack}
                    onBack={() => nav.pop()}
                    currentLabel={displayRuntime.graphic.name}
                    stackLabels={stackLabels}
                    floors={floors}
                    activeFloor={activeFloor}
                    onFloorChange={setActiveFloor}
                  />
                ),
              }}
            />
            )}
          </>
        }
      </div>
    </div>
  );
}

/* ── Trend View ────────────────────────────── */
function TrendView({ allTags, selectedTagId, onSelect, trend, selectedTag }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="viewer-layout">
        <div className="side-list">
          <div className="side-list-header">Tags ({allTags.length})</div>
          {allTags.length === 0 && <div className="empty" style={{ minHeight: 120 }}><p>No tags yet - run the Engine.</p></div>}
          {allTags.map((t: CurrentTagValue) => (
            <button key={t.id} className={`side-list-btn ${selectedTagId === t.id ? 'active' : ''}`} onClick={() => onSelect(t.id)}>
              <span style={{ fontWeight: 700 }}>{t.name}</span><br />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.deviceName}</span>
            </button>
          ))}
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h2>Trend {selectedTag ? `— ${selectedTag.deviceName} / ${selectedTag.name}` : ''}</h2>
          </div>
          <div style={{ padding: 14, flex: 1, background: '#f8fcfd' }}>
            {trend && trend.count > 0
              ? <SvgTrendChart data={trend} tagName={selectedTag?.name} unit={selectedTag?.unit ?? ''} />
              : <div className="empty" style={{ minHeight: 200 }}><TrendingUp size={32} color="#9fc4cc" /><p>Select a tag with history to view the chart.</p></div>
            }
          </div>
        </div>
      </div>
      {trend && trend.count > 0 && (
        <div className="card">
          <div className="card-header"><h3>Raw Data (latest 100 rows)</h3><span className="chip">{trend.count} points</span></div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Time</th><th>Tag</th><th>Value</th><th>Quality</th></tr></thead>
            <tbody>
              {trend.values.slice(-100).reverse().map((p: TrendPoint) => (
                <tr key={p.id}>
                  <td style={{ fontSize: 12 }}>{fmtDate(p.readAt)}</td>
                  <td>{p.tagName}</td>
                  <td><b>{p.value?.toFixed(2) ?? '--'} {p.unit}</b></td>
                  <td><StatusBadge value={p.quality} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

/* ── Alarm View ────────────────────────────── */
function AlarmView({ alarms, onAck }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="alarm-kpi-row">
        <div className="alarm-kpi"><div className="alarm-kpi-label">Active</div><div className="alarm-kpi-val red">{alarms?.summary?.active ?? 0}</div></div>
        <div className="alarm-kpi"><div className="alarm-kpi-label">Unacknowledged</div><div className="alarm-kpi-val amber">{alarms?.summary?.unacknowledged ?? 0}</div></div>
        <div className="alarm-kpi"><div className="alarm-kpi-label">Cleared</div><div className="alarm-kpi-val muted">{alarms?.summary?.cleared ?? 0}</div></div>
      </div>
      <div className="card">
        <div className="card-header"><h2>Alarm List</h2></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Severity</th><th>Device.Tag</th><th>Message</th><th>Status</th><th>Ack</th><th>Started</th><th>Action</th></tr></thead>
          <tbody>
            {(alarms?.alarms ?? []).length === 0
              ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>No alarms.</td></tr>
              : (alarms?.alarms ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td><StatusBadge value={a.severity} /></td>
                  <td><b>{a.deviceName}</b>.{a.tagName}</td>
                  <td style={{ maxWidth: 240 }}>{a.message}</td>
                  <td><StatusBadge value={a.status} /></td>
                  <td>{a.acknowledged ? <span className="badge unknown">Done</span> : <span className="badge warn">Pending</span>}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(a.startedAt)}</td>
                  <td>{!a.acknowledged && <button className="ack-btn" onClick={() => onAck(a.id)}>Acknowledge</button>}</td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

/* ── Report View ───────────────────────────── */
function ReportView({ reports, generatedReports, onGenerate }: any) {
  const engineUrl = getEngineUrl();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div className="card-header"><h2>Report Templates</h2></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Name</th><th>Type</th><th>Range</th><th>Format</th><th>Actions</th></tr></thead>
          <tbody>
            {reports.length === 0
              ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>No reports from Editor yet.</td></tr>
              : reports.map((r: ReportSummary) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td>{r.reportType}</td>
                  <td>{r.defaultDateRange}</td>
                  <td>{r.outputFormat}</td>
                  <td>
                    <button className="btn" style={{ marginRight: 6 }} onClick={() => onGenerate(r.id, 'pdf')}>PDF</button>
                    <button className="btn" onClick={() => onGenerate(r.id, 'excel')}>Excel</button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="card-header"><h2>Generated Files</h2><span className="chip">{generatedReports.length} files</span></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>File</th><th>Size</th><th>Created</th><th>Download</th></tr></thead>
          <tbody>
            {generatedReports.length === 0
              ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>No files yet.</td></tr>
              : generatedReports.map((f: GeneratedReportFile) => (
                <tr key={f.fileName}>
                  <td>{f.fileName}</td>
                  <td>{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(f.createdAt)}</td>
                  <td><a href={`${engineUrl}${f.downloadUrl}`} target="_blank" rel="noreferrer"><Download size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Open</a></td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

/* ── Device View ───────────────────────────── */
function DeviceView({ devices }: any) {
  return (
    <div className="card">
      <div className="card-header"><h2>Device Status</h2><span className="chip">{devices.length} devices</span></div>
      <div className="tbl-wrap"><table>
        <thead><tr><th>Name</th><th>Type</th><th>Protocol</th><th>Address</th><th>Tags</th><th>Status</th></tr></thead>
        <tbody>
          {devices.length === 0
            ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>No devices yet.</td></tr>
            : devices.map((d: RuntimeDevice) => (
              <tr key={d.id}>
                <td><b>{d.name}</b><br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{d.description}</span></td>
                <td>{d.type}</td>
                <td>{d.protocol}</td>
                <td style={{ fontSize: 12 }}>{d.ipAddress ? `${d.ipAddress}:${d.port ?? '-'}` : '--'}</td>
                <td>{d.tags?.length ?? 0}</td>
                <td><StatusBadge value={d.status ?? 'unknown'} /></td>
              </tr>
            ))
          }
        </tbody>
      </table></div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────── */
function MetricCard({ label, value, cls, icon }: { label: string; value: number; cls?: string; icon?: React.ReactNode }) {
  return (
    <div className={`metric metric-card-styled ${cls ?? ''}`}>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className={`metric-value`}>{value}</div>
      </div>
      {icon && <div className="metric-icon-wrap">{icon}</div>}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f3fbfc', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 16px', textAlign: 'center', minWidth: 120 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--teal-800)' }}>{value}</div>
    </div>
  );
}
