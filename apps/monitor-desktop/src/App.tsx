import React from 'react';
import {
  LayoutDashboard,
  MonitorPlay,
  TrendingUp,
  BellRing,
  FileBarChart2,
  Cpu,
  RefreshCw,
  Play,
  Square,
  Zap,
  Activity,
  Radio,
  Leaf,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Circle,
  ChevronRight,
  ChevronLeft,
  Download,
  Check,
  Palette,
} from 'lucide-react';
import { currentEngineUrl, engineApi, probeEngineUrl, setEngineUrl } from './api/engineApi';
import { StatusBadge } from './components/StatusBadge';
import { DeviceAvatar } from './components/DeviceAvatar';
import {
  PowerTrendChart,
  DevicePowerBarChart,
  DeviceStatusDonut,
  CommunicationDonut,
} from './components/DashboardCharts';
import { EmptyPanel, MonitorNavBar, ViewSearchInput } from './components/ViewHelpers';
import { TrendAnalysis } from './components/TrendAnalysis';
import { FullscreenPanel } from './components/FullscreenPanel';
import { SidebarDeviceTree } from './components/SidebarDeviceTree';
import { DeviceManagementView } from './components/DeviceManagement';
import { CarbonKpiAccent, EnergySavingAccent, EnergySavingsWidget } from './components/SustainabilityWidgets';
import {
  KpiAlarmAccent,
  KpiCommAccent,
  KpiCostAccent,
  KpiDeviceAccent,
  KpiPeakAccent,
  KpiPowerAccent,
} from './components/KpiAccents';
import { computeSustainabilityMetrics } from './utils/sustainability';
import { CarbonImpactCard } from './components/CarbonImpactCard';
import { DashboardDeviceTree } from './components/DashboardDeviceTree';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { NotificationCenter } from './components/NotificationCenter';
import { DashboardView } from './views/DashboardView';
import { calculateTotalPower } from './utils/dashboardMetrics';
import {
  buildRuntimeIndexes,
  getDeviceLiveStatus,
  countDevicesByStatus,
  topDevicePowerItems,
  type RuntimeIndexes,
} from './utils/runtimeIndexes';
import { SCALE } from './utils/scaleConfig';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { isFreshRead, latestDeviceReadAt, normalizeQuality } from './utils/runtimeQuality';
import type {
  ApiStatus,
  AlarmSummary,
  CommunicationCapabilities,
  CurrentTagValue,
  GeneratedReportFile,
  GraphicObject,
  GraphicSummary,
  ReportSummary,
  RuntimeAlarm,
  RuntimeGraphicResponse,
  RuntimePollingStatus,
  RuntimeTag,
} from './types/monitor';
import './styles/monitor.css';

import { RuntimeGraphicViewport, GraphicNavigationBar, useGraphicNavigation, collectFloorLevels } from './components/GraphicsRuntime';
import { HtmlGraphicComposite } from '@energylink/graphics-runtime';
import type { GraphicLayout } from '@energylink/shared-types';
import { isHtmlGraphicPage } from '@energylink/shared-types';
import type { MonitorState, ConnectionState, ViewKey } from './appShared';
export type { MonitorState, ConnectionState, ViewKey };

function fmtVal(v: CurrentTagValue): string {
  if (v.value === null || v.value === undefined) return '--';
  return `${Number(v.value).toFixed(v.decimalPlaces ?? 2)}${v.unit ? ` ${v.unit}` : ''}`;
}

function fmtDate(s?: string | null): string {
  if (!s) return '--';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

type DetailRowCell = {
  phase?: string;
  tag: RuntimeTag;
  value?: CurrentTagValue;
};

type DetailRow = {
  label: string;
  cells: DetailRowCell[];
};

type DetailGroup = {
  title: string;
  rows: DetailRow[];
  phaseLabels?: string[];
};

type DeviceDetailTab = 'general' | 'instantaneous' | 'maximum' | 'minimum' | 'energy' | 'harmonics' | 'status';

const PHASES_ORDER = ['L1', 'L2', 'L3', 'A', 'B', 'C', 'T1', 'T2', 'Total', 'Neutral'];
const CATEGORY_ORDER = ['Voltage', 'Current', 'Power', 'Power Factor', 'Energy', 'Frequency', 'Quality / Status', 'Other'];
const DEVICE_GROUP_TITLES: Record<string, string> = {
  Voltage: 'A. Voltage',
  Current: 'B. Current',
  Power: 'C. Active / Reactive / Apparent Power',
  'Power Factor': 'D. Power Factor',
  Energy: 'E. Energy',
  'Quality / Status': 'F. Quality / Status',
  Frequency: 'Frequency',
  Other: 'Other Parameters'
};

function normalizeLabel(name: string): string {
  return name.replace(/\s+/g, ' ').replace(/[\-_]+/g, ' ').trim();
}

function titleCase(text: string) {
  return normalizeLabel(text)
    .toLowerCase()
    .replace(/\b\w/g, value => value.toUpperCase())
    .replace(/\bThd\b/g, 'THD')
    .replace(/\bKwh\b/g, 'kWh')
    .replace(/\bKvarh\b/g, 'kVArh')
    .replace(/\bKvar\b/g, 'kVAr')
    .replace(/\bKva\b/g, 'kVA')
    .replace(/\bKw\b/g, 'kW');
}

function valueSuffix(name: string) {
  const lower = name.toLowerCase();
  if (/\bmax(imum)?\b/.test(lower)) return ' MAX';
  if (/\bmin(imum)?\b/.test(lower)) return ' MIN';
  if (/\bmax\s*demand\b|\bmd\b/.test(lower)) return ' MD';
  return '';
}

function extractPhaseAndBase(name: string): { base: string; phase?: string } {
  const cleaned = name.replace(/[()\[\],]/g, ' ').replace(/\s+/g, ' ').trim();
  const pairMatch = cleaned.match(/\b(l1|l2|l3|a|b|c|t1|t2|total|neutral|l)\s*[-–]\s*(l1|l2|l3|a|b|c|t1|t2|total|neutral|l)\b/i);
  if (pairMatch) {
    const first = pairMatch[1].toUpperCase();
    const second = pairMatch[2].toUpperCase();
    const phasePair = `${first}-${second}`;
    const phase = phasePair === 'L1-L2' ? 'L1' : phasePair === 'L2-L3' ? 'L2' : phasePair === 'L3-L1' ? 'L3' : phasePair;
    const base = normalizeLabel(cleaned.replace(new RegExp(`\\b${pairMatch[0]}\\b`, 'i'), ''));
    return { base: base || normalizeLabel(name), phase };
  }

  const match = cleaned.match(/\b(L1|L2|L3|A|B|C|T1|T2|Total|Neutral)\b/i);
  const phase = match?.[1]?.toUpperCase();
  const base = normalizeLabel(match ? cleaned.replace(new RegExp(`\\b${match[1]}\\b`, 'i'), '') : cleaned);
  return { base: base || normalizeLabel(name), phase };
}

function getFieldInfo(name: string): { category: string; label: string; phase?: string } {
  const lower = name.toLowerCase();
  const { base, phase } = extractPhaseAndBase(name);
  const labelBase = normalizeLabel(base);
  const suffix = valueSuffix(name);

  if (/frequency|hz/.test(lower)) {
    return { category: 'Voltage', label: 'Frequency', phase: phase ?? 'Total' };
  }
  if (/thd/.test(lower) && /voltage|harm/.test(lower)) {
    return { category: 'Voltage', label: 'Voltage THD %', phase: phase ?? 'Total' };
  }
  if (/thd/.test(lower) && /current|harm/.test(lower)) {
    return { category: 'Current', label: 'Current THD %', phase: phase ?? 'Total' };
  }
  if (/three[- ]?phase voltage|line iii voltage|v(n|\s*iii)/.test(lower)) {
    return { category: 'Voltage', label: `Three-phase voltage${suffix}`, phase: 'Total' };
  }
  if (/phase[- ]?neutral|line[- ]?neutral|l[- ]?n\b|\bvn\b|phase voltage/.test(lower)) {
    return { category: 'Voltage', label: `Phase voltage${suffix}`, phase: phase ?? 'Total' };
  }
  if (/phase[- ]?phase|line[- ]?line|l[- ]?l\b|ll\b|voltage\s+l[123]\s*[-–]\s*l[123]/.test(lower)) {
    return { category: 'Voltage', label: `Phase-phase voltage${suffix}`, phase: phase ?? 'Total' };
  }
  if (/voltage/.test(lower) || /phase\s*voltage|line\s*voltage/.test(lower)) {
    return { category: 'Voltage', label: `Voltage${suffix}`, phase: phase ?? 'Total' };
  }

  if (/power factor|\bpf\b/.test(lower)) {
    return { category: 'Power Factor', label: `Power Factor${suffix}`, phase: phase ?? 'Total' };
  }

  if (/capacitive/.test(lower) && /power/.test(lower)) {
    return { category: 'Power', label: `Capacitive Reactive Power${suffix}`, phase: /three[- ]?phase|\biii\b/.test(lower) ? 'Total' : phase ?? 'Total' };
  }
  if (/inductive/.test(lower) && /power/.test(lower)) {
    return { category: 'Power', label: `Inductive Reactive Power${suffix}`, phase: /three[- ]?phase|\biii\b/.test(lower) ? 'Total' : phase ?? 'Total' };
  }
  if (/active power|\bkw\b/.test(lower)) {
    return { category: 'Power', label: `Active Power${suffix}`, phase: /three[- ]?phase|\biii\b/.test(lower) ? 'Total' : phase ?? 'Total' };
  }
  if (/reactive power|\bkvar\b/.test(lower)) {
    return { category: 'Power', label: `Reactive Power${suffix}`, phase: /three[- ]?phase|\biii\b/.test(lower) ? 'Total' : phase ?? 'Total' };
  }
  if (/apparent power|\bkva\b/.test(lower)) {
    return { category: 'Power', label: `Apparent Power${suffix}`, phase: /three[- ]?phase|\biii\b/.test(lower) ? 'Total' : phase ?? 'Total' };
  }

  if (/current|ampere|\bamp\b|\ba\b/.test(lower)) {
    if (/neutral|n\b/.test(lower)) return { category: 'Current', label: `Neutral current${suffix}`, phase: 'Total' };
    if (/three[- ]?phase|\biii\b/.test(lower)) return { category: 'Current', label: `Three-phase current${suffix}`, phase: 'Total' };
    return { category: 'Current', label: `Current${suffix}`, phase: phase ?? 'Total' };
  }

  if (/total active energy/i.test(lower)) {
    if (/\+.*t1|t1.*\+/i.test(lower)) return { category: 'Energy', label: 'Total Active Energy + T1', phase: phase ?? 'Total' };
    if (/\+.*t2|t2.*\+/i.test(lower)) return { category: 'Energy', label: 'Total Active Energy + T2', phase: phase ?? 'Total' };
    if (/-.*t1|t1.*-/i.test(lower)) return { category: 'Energy', label: 'Total Active Energy - T1', phase: phase ?? 'Total' };
    if (/-.*t2|t2.*-/i.test(lower)) return { category: 'Energy', label: 'Total Active Energy - T2', phase: phase ?? 'Total' };
    if (/\+/.test(lower)) return { category: 'Energy', label: 'Total Active Energy +', phase: phase ?? 'Total' };
    if (/-/.test(lower)) return { category: 'Energy', label: 'Total Active Energy -', phase: phase ?? 'Total' };
    return { category: 'Energy', label: 'Total Active Energy', phase: phase ?? 'Total' };
  }
  if (/total reactive energy/i.test(lower)) {
    if (/\+.*t1|t1.*\+/i.test(lower)) return { category: 'Energy', label: 'Total Reactive Energy + T1', phase: phase ?? 'Total' };
    if (/\+.*t2|t2.*\+/i.test(lower)) return { category: 'Energy', label: 'Total Reactive Energy + T2', phase: phase ?? 'Total' };
    if (/-.*t1|t1.*-/i.test(lower)) return { category: 'Energy', label: 'Total Reactive Energy - T1', phase: phase ?? 'Total' };
    if (/-.*t2|t2.*-/i.test(lower)) return { category: 'Energy', label: 'Total Reactive Energy - T2', phase: phase ?? 'Total' };
    if (/\+/.test(lower)) return { category: 'Energy', label: 'Total Reactive Energy +', phase: phase ?? 'Total' };
    if (/-/.test(lower)) return { category: 'Energy', label: 'Total Reactive Energy -', phase: phase ?? 'Total' };
    return { category: 'Energy', label: 'Total Reactive Energy', phase: phase ?? 'Total' };
  }

  if (/frequency stability/i.test(lower)) return { category: 'Quality / Status', label: 'Frequency stability', phase: 'Total' };
  if (/communication/i.test(lower)) return { category: 'Quality / Status', label: 'Communication', phase: 'Total' };
  if (/tag quality/i.test(lower)) return { category: 'Quality / Status', label: 'Tag quality', phase: 'Total' };
  if (/last read freshness|freshness/i.test(lower)) return { category: 'Quality / Status', label: 'Last read freshness', phase: 'Total' };

  if (/quality|status/.test(lower)) return { category: 'Quality / Status', label: titleCase(labelBase), phase: phase ?? 'Total' };
  if (/energy|kwh|kvarh/.test(lower)) return { category: 'Energy', label: titleCase(labelBase), phase: phase ?? 'Total' };
  if (/power/.test(lower)) return { category: 'Power', label: titleCase(labelBase), phase: phase ?? 'Total' };
  if (/current/.test(lower)) return { category: 'Current', label: titleCase(labelBase), phase: phase ?? 'Total' };
  if (/voltage|phase/.test(lower)) return { category: 'Voltage', label: titleCase(labelBase), phase: phase ?? 'Total' };

  return { category: 'Other', label: titleCase(labelBase), phase: phase ?? 'Total' };
}

function buildDeviceTemplateGroups(tags: RuntimeTag[], currentValues: CurrentTagValue[]): DetailGroup[] {
  const valuesById = new Map(currentValues.map(v => [v.id, v]));
  const categoryMap = new Map<string, Map<string, DetailRow>>();
  const phaseLabelMap = new Map<string, Set<string>>();

  for (const tag of tags) {
    const info = getFieldInfo(tag.name);
    if (!categoryMap.has(info.category)) categoryMap.set(info.category, new Map());
    const rowMap = categoryMap.get(info.category)!;
    if (!rowMap.has(info.label)) rowMap.set(info.label, { label: info.label, cells: [] });
    const row = rowMap.get(info.label)!;
    const cell: DetailRowCell = { tag, value: valuesById.get(tag.id), phase: info.phase };

    // If this cell has a phase, record phase labels for the category
    if (cell.phase) {
      if (!phaseLabelMap.has(info.category)) phaseLabelMap.set(info.category, new Set());
      phaseLabelMap.get(info.category)!.add(cell.phase);
    }

    // Merge duplicate phase cells: prefer non-null values, otherwise the most recent read
    if (cell.phase) {
      const existingIdx = row.cells.findIndex(c => c.phase === cell.phase);
      if (existingIdx >= 0) {
        const existing = row.cells[existingIdx];
        const ev = existing.value?.value;
        const nv = cell.value?.value;
        if (nv !== null && nv !== undefined && (ev === null || ev === undefined)) {
          row.cells[existingIdx] = cell;
        } else if (nv !== null && nv !== undefined && ev !== null && ev !== undefined) {
          const eDate = existing.value?.lastValueAt ? new Date(existing.value!.lastValueAt).getTime() : 0;
          const nDate = cell.value?.lastValueAt ? new Date(cell.value!.lastValueAt).getTime() : 0;
          if (nDate > eDate) row.cells[existingIdx] = cell;
        }
        // else keep existing (prefer non-null or earlier one)
      } else {
        row.cells.push(cell);
      }
    } else {
      // No phase: simply push (summary/total values)
      row.cells.push(cell);
    }
  }

  // Remove rows that have no readable values (all cells null/undefined)
  for (const [category, rowMap] of categoryMap.entries()) {
    for (const [label, row] of Array.from(rowMap.entries())) {
      const hasReadable = row.cells.some(c => c.value && c.value.value !== null && c.value.value !== undefined);
      if (!hasReadable) rowMap.delete(label);
    }
    if (rowMap.size === 0) categoryMap.delete(category);
  }

  const groups: DetailGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const rows = categoryMap.get(category);
    if (!rows) continue;
    const phaseLabelsSet = phaseLabelMap.get(category);
    const phaseLabels = phaseLabelsSet && phaseLabelsSet.size > 1
      ? Array.from(phaseLabelsSet).sort((a, b) => {
        const ai = PHASES_ORDER.indexOf(a);
        const bi = PHASES_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
      })
      : undefined;
    groups.push({
      title: category,
      rows: Array.from(rows.values()),
      phaseLabels,
    });
  }

  if (groups.length === 0) {
    return [{
      title: 'Parameters',
      rows: tags.map(tag => ({ label: normalizeLabel(tag.name), cells: [{ tag, value: valuesById.get(tag.id) }] })),
    }];
  }

  return groups;
}

function renderDetailValue(value?: CurrentTagValue): React.ReactNode {
  if (!value || value.value === null || value.value === undefined) return '--';
  return (
    <>
      <span className="device-detail-value">{Number(value.value).toFixed(value.decimalPlaces ?? 2)}</span>
      {value.unit && <span className="device-detail-unit">{value.unit}</span>}
    </>
  );
}

function qualityLabel(quality?: string | null) {
  const q = String(quality ?? 'unknown').toLowerCase();
  if (q === 'good') return 'Valid';
  if (q === 'bad') return 'Invalid';
  if (q === 'uncertain' || q === 'warn' || q === 'warning') return 'Uncertain';
  return q === 'unknown' ? 'Unknown' : q;
}

function measurementRows(groups: DetailGroup[]) {
  return groups
    .filter(group => group.title !== 'Quality / Status' && group.title !== 'Other')
    .flatMap(group => group.rows.map(row => ({ ...row, category: group.title })));
}

function rowHasValue(row: DetailRow) {
  return row.cells.some(cell => cell.value?.value !== null && cell.value?.value !== undefined);
}

function rowLabelForTab(label: string, tab: DeviceDetailTab) {
  if (tab === 'maximum') return label.replace(/\s+MAX$/i, '');
  if (tab === 'minimum') return label.replace(/\s+MIN$/i, '');
  return label;
}

function rowsForDeviceTab(groups: DetailGroup[], tab: DeviceDetailTab) {
  const rows = measurementRows(groups);
  const filtered = rows.filter(row => {
    const label = row.label.toLowerCase();
    if (tab === 'energy') return row.category === 'Energy';
    if (tab === 'harmonics') return /thd|harmonic|harm/.test(label);
    if (tab === 'maximum') return /\bmax\b|maximum/.test(label);
    if (tab === 'minimum') return /\bmin\b|minimum/.test(label);
    if (tab === 'general') {
      return [
        'phase voltage',
        'phase-phase voltage',
        'current',
        'active power',
        'power factor',
        'frequency'
      ].some(name => label === name);
    }
    return row.category !== 'Energy' && !/thd|harmonic|harm|\bmax\b|maximum|\bmin\b|minimum/.test(label);
  });

  return filtered.filter(rowHasValue);
}

function renderCircutorTable(rows: Array<DetailRow & { category?: string }>, tab: DeviceDetailTab) {
  const phases = ['L1', 'L2', 'L3', 'Total'];
  return (
    <table className="circutor-table">
      <thead>
        <tr>
          <th>Parameter</th>
          {phases.map(phase => <th key={phase}>{phase}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={5} className="circutor-empty">No parameters available for this view.</td></tr>
        ) : rows.map((row, i) => (
          <tr key={`${tab}:${row.label}`} className="table-row-animate" style={{ animationDelay: `${i * 0.02}s` }}>
            <td>{rowLabelForTab(row.label, tab)}</td>
            {phases.map(phase => {
              const cell = row.cells.find(c => c.phase === phase) ?? (phase === 'Total' ? row.cells.find(c => !c.phase) : undefined);
              return <td key={phase}>{cell ? renderDetailValue(cell.value) : '--'}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* Graphics View */
export function GraphicsView({ runtimeGraphic, graphicsStatus, graphicsList = [], currentValues, alarms, onWriteTag, onNavigateGraphic, onAcknowledge }: { runtimeGraphic?: RuntimeGraphicResponse; graphicsStatus?: { message: string }; graphicsList?: Array<{ id: string; name: string }>; currentValues: CurrentTagValue[]; alarms: RuntimeAlarm[]; onWriteTag: (tagId: string, tagName: string, dataType: string) => void; onNavigateGraphic?: (graphicId: string) => void; onAcknowledge?: (alarmId: string) => void }) {
  const [graphicFullscreen, setGraphicFullscreen] = React.useState(false);
  const [diagramMode, setDiagramMode] = React.useState(false);
  const [displayRuntime, setDisplayRuntime] = React.useState(runtimeGraphic);
  const [activeFloor, setActiveFloor] = React.useState<number | null>(null);
  const rootId = runtimeGraphic?.graphic?.id ?? '';
  const nav = useGraphicNavigation(rootId);

  React.useEffect(() => {
    setDisplayRuntime(runtimeGraphic);
    if (runtimeGraphic?.graphic?.id) {
      nav.reset(runtimeGraphic.graphic.id);
    }
    setActiveFloor(null);
  }, [runtimeGraphic?.graphic?.id]);

  React.useEffect(() => {
    if (!nav.currentId || nav.currentId === displayRuntime?.graphic?.id) return;
    void (async () => {
      const result = await engineApi.getGraphic(nav.currentId);
      if (result.ok) setDisplayRuntime(result.data);
    })();
  }, [nav.currentId, displayRuntime?.graphic?.id]);

  if (!displayRuntime) {
    return (
      <div className="view-page">
        <EmptyPanel
          icon={<MonitorPlay size={40} color="var(--chart-primary)" />}
          title={graphicsStatus?.message ?? 'No graphics yet.'}
        />
      </div>
    );
  }

  const graphic = displayRuntime.graphic;
  const layout = graphic.layout as GraphicLayout;
  const htmlPage = isHtmlGraphicPage(layout);
  const objects = graphic.layout.objects ?? [];
  const stageW = graphic.width || 1200;
  const stageH = graphic.height || 768;
  const floors = collectFloorLevels(objects);
  const stackLabels = nav.stack.map((id) => graphicsList.find((g) => g.id === id)?.name ?? id.slice(-6));

  const handleNavigate = (graphicId: string) => {
    nav.push(graphicId);
    onNavigateGraphic?.(graphicId);
  };

  const handleBack = () => {
    nav.pop();
  };

  return (
    <div className="view-page">
      <div className="card graphics-runtime-card dash-animate dash-animate-delay-2">
        <div className="graphics-runtime-header">
          <div>
            <h2>{graphic.name}</h2>
            <p>Live runtime display · {stageW}×{stageH}</p>
          </div>
          <span className="runtime-chip runtime-chip-teal">
            {htmlPage ? `${objects.length} Overlay` : `${objects.length} Objects`}
          </span>
          <div className="graphics-view-modes">
            <button
              type="button"
              className={`btn secondary tiny${diagramMode ? ' active' : ''}`}
              onClick={() => setDiagramMode((v) => !v)}
              title="Zoom and pan diagram mode"
            >
              Diagram
            </button>
          </div>
        </div>
        <FullscreenPanel
          className="graphics-fullscreen-panel"
          label="Fullscreen graphic"
          onFullscreenChange={setGraphicFullscreen}
        >
          {htmlPage ? (
            <HtmlGraphicComposite
              layout={layout}
              width={stageW}
              height={stageH}
              objects={objects}
              currentValues={currentValues}
              onWriteTag={onWriteTag}
              interactive
              className="monitor-html-page"
              overlayStageProps={{
                alarms,
                onNavigate: handleNavigate,
                onAcknowledge,
                fetchTrend: async (opts) => {
                  const r = await engineApi.getTrend(opts);
                  return r.ok ? r.data : null;
                },
                refreshIntervalMs: graphic.refreshIntervalMs ?? 10000,
                fitViewport: graphicFullscreen && !diagramMode,
                diagramMode,
                wrapClassName: 'graphic-stage-scroll',
                stageClassName: 'graphic-runtime-stage graphic-stage-enter',
                animate: true,
                activeFloor,
                navigationBar: (
                  <GraphicNavigationBar
                    canGoBack={nav.canGoBack}
                    onBack={handleBack}
                    currentLabel={graphic.name}
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
            layout={graphic.layout as GraphicLayout}
            objects={objects}
            cameraPreset={(graphic.layout as GraphicLayout).defaultCamera ?? 'flat'}
            activeFloor={activeFloor}
            backgroundColor={graphic.layout.backgroundColor ?? '#fbfdff'}
            backgroundImage={graphic.layout.backgroundImage}
            stageProps={{
              currentValues,
              alarms,
              onWriteTag,
              onNavigate: handleNavigate,
              onAcknowledge,
              fetchTrend: async (opts) => {
                const r = await engineApi.getTrend(opts);
                return r.ok ? r.data : null;
              },
              refreshIntervalMs: graphic.refreshIntervalMs ?? 10000,
              fitViewport: graphicFullscreen && !diagramMode,
              diagramMode,
              wrapClassName: 'graphic-stage-scroll',
              stageClassName: 'graphic-runtime-stage graphic-stage-enter',
              animate: true,
              navigationBar: (
                <GraphicNavigationBar
                  canGoBack={nav.canGoBack}
                  onBack={handleBack}
                  currentLabel={graphic.name}
                  stackLabels={stackLabels}
                  floors={floors}
                  activeFloor={activeFloor}
                  onFloorChange={setActiveFloor}
                />
              ),
            }}
          />
          )}
        </FullscreenPanel>
      </div>
    </div>
  );
}

// English comment
export function AlarmView({ alarms, summary, onAcknowledge }: { alarms: RuntimeAlarm[]; summary?: AlarmSummary; onAcknowledge: (id: string) => void }) {
  const [filter, setFilter] = React.useState<'all' | 'active' | 'critical'>('all');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  const filtered = React.useMemo(() => alarms.filter(a => {
    if (filter === 'active' && a.status !== 'active') return false;
    if (filter === 'critical' && a.severity !== 'critical') return false;
    const q = debouncedSearch.toLowerCase();
    if (!q) return true;
    return (
      a.message?.toLowerCase().includes(q) ||
      a.deviceName?.toLowerCase().includes(q) ||
      a.tagName?.toLowerCase().includes(q)
    );
  }), [alarms, filter, debouncedSearch]);

  const pageSize = SCALE.ALARM_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedAlarms = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  React.useEffect(() => {
    setPage(0);
  }, [filter, debouncedSearch]);

  return (
    <div className="view-page view-stack">
      <div className="alarm-summary-row dash-animate dash-animate-delay-1">
        <div className="alarm-kpi alarm-kpi-card">
          <div className="alarm-kpi-label">Active</div>
          <div className="alarm-kpi-val red">{summary?.active ?? 0}</div>
        </div>
        <div className="alarm-kpi alarm-kpi-card">
          <div className="alarm-kpi-label">Unacknowledged</div>
          <div className="alarm-kpi-val amber">{summary?.unacknowledged ?? 0}</div>
        </div>
        <div className="alarm-kpi alarm-kpi-card">
          <div className="alarm-kpi-label">Cleared</div>
          <div className="alarm-kpi-val muted">{summary?.cleared ?? 0}</div>
        </div>
      </div>

      <div className="view-filter-row dash-animate dash-animate-delay-2">
        <div className="view-filter-tabs">
          {(['all', 'active', 'critical'] as const).map(f => (
            <button key={f} type="button" className={`view-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Critical'}
            </button>
          ))}
        </div>
        <ViewSearchInput value={search} onChange={setSearch} placeholder="Search alarms..." />
      </div>

      <div className="card dash-animate dash-animate-delay-3">
        <div className="card-header">
          <h2>Alarm List</h2>
          <div className="card-header-actions">
            {(summary?.active ?? 0) > 0 && (
              <span className="badge-alert-count">{summary?.active} Active</span>
            )}
            <span className="runtime-chip">{filtered.length} shown</span>
          </div>
        </div>
        <div className="table-scroll-wrap">
          <table className="data-table data-table-modern">
            <thead>
              <tr><th>Severity</th><th>Device</th><th>Tag</th><th>Message</th><th>Status</th><th>Ack</th><th>Started</th><th>Action</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8} className="table-empty-cell">No alarms match your filters.</td></tr>
                : pagedAlarms.map((a, i) => (
                  <tr key={a.id} className="table-row-animate alarm-row" style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
                    <td><span className={`status-badge ${a.severity === 'critical' ? 'bad' : a.severity === 'warning' ? 'warn' : 'unknown'}`}>{a.severity}</span></td>
                    <td>{a.deviceName}</td>
                    <td><b>{a.tagName}</b></td>
                    <td className="cell-message">{a.message}</td>
                    <td><span className={`status-badge ${a.status}`}>{a.status}</span></td>
                    <td>{a.acknowledged ? <span className="status-badge acknowledged"><Check size={10} /> Done</span> : <span className="status-badge warn">Pending</span>}</td>
                    <td className="cell-muted">{fmtDate(a.startedAt)}</td>
                    <td>{!a.acknowledged && <button className="ack-btn" onClick={() => onAcknowledge(a.id)}>Acknowledge</button>}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        {filtered.length > pageSize && (
          <div className="pagination-row">
            <button
              type="button"
              className="btn-outline toolbar-btn"
              disabled={currentPage <= 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="pagination-label">
              Page {currentPage + 1} / {totalPages} · {filtered.length} alarms
            </span>
            <button
              type="button"
              className="btn-outline toolbar-btn"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// English comment
export function ReportView({ reports, generatedReports, message, onGenerate, engineUrl }: { reports: ReportSummary[]; generatedReports: GeneratedReportFile[]; message?: string; onGenerate: (id: string, f: 'pdf' | 'excel') => void; engineUrl: string }) {
  return (
    <div className="view-page view-stack">
      {message && <div className="alert info view-alert dash-animate">{message}</div>}

      <div className="card dash-animate dash-animate-delay-2">
        <div className="card-header"><h2>Report Templates</h2></div>
        {reports.length === 0 ? (
          <div className="empty-small pad-empty">No report templates from Editor yet.</div>
        ) : (
          <div className="report-template-grid">
            {reports.map((r, i) => (
              <div key={r.id} className="report-template-card dash-animate" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                <div className="report-template-head">
                  <FileBarChart2 size={18} className="report-template-icon" />
                  <div>
                    <b>{r.name}</b>
                    <span>{r.reportType}</span>
                  </div>
                </div>
                <div className="report-template-meta">
                  <span>{r.defaultDateRange}</span>
                  <span>{r.outputFormat}</span>
                </div>
                <div className="report-template-actions">
                  <button className="btn-outline" onClick={() => onGenerate(r.id, 'pdf')}>PDF</button>
                  <button className="btn-primary" onClick={() => onGenerate(r.id, 'excel')}>Excel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card dash-animate dash-animate-delay-3">
        <div className="card-header">
          <h2>Generated Files</h2>
          <span className="runtime-chip">{generatedReports.length} files</span>
        </div>
        <div className="table-scroll-wrap">
          <table className="data-table data-table-modern">
            <thead><tr><th>File Name</th><th>Size</th><th>Created</th><th>Download</th></tr></thead>
            <tbody>
              {generatedReports.length === 0
                ? <tr><td colSpan={4} className="table-empty-cell">No generated files yet.</td></tr>
                : generatedReports.map((f, i) => (
                  <tr key={f.fileName} className="table-row-animate" style={{ animationDelay: `${i * 0.03}s` }}>
                    <td><b>{f.fileName}</b></td>
                    <td>{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="cell-muted">{fmtDate(f.createdAt)}</td>
                    <td><a className="link-download" href={`${engineUrl}${f.downloadUrl}`} target="_blank" rel="noreferrer"><Download size={14} /> Open</a></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// English comment
export function DeviceDetailsView({ device, currentValues, indexes, onBack, onWriteTag }: { device?: any; currentValues: CurrentTagValue[]; indexes: RuntimeIndexes; onBack: () => void; onWriteTag: (tagId: string, tagName: string, dataType: string) => void }) {
  const [activeTab, setActiveTab] = React.useState<DeviceDetailTab>('general');
  if (!device) {
    return (
      <div className="card">
        <div className="card-header"><h2>Device Not Found</h2></div>
        <div className="card-body">Selected device not available.</div>
      </div>
    );
  }

  const groups = buildDeviceTemplateGroups(device.tags ?? [], currentValues);
  const deviceValues = currentValues.filter(value => value.deviceId === device.id);
  const liveStatus = getDeviceLiveStatus(device, indexes);
  const latestReadAt = liveStatus.latestReadAt ?? latestDeviceReadAt(deviceValues);
  const goodCount = deviceValues.filter(value => normalizeQuality(value.quality) === 'good').length;
  const totalCount = deviceValues.length;
  const overallQuality = totalCount > 0 && goodCount === totalCount ? 'good' : goodCount > 0 ? 'warn' : 'bad';
  const endpoint = device.ipAddress
    ? `${device.ipAddress}:${device.port ?? '-'}`
    : device.serialPort
      ? device.serialPort
      : device.parent?.ipAddress
        ? `${device.parent.ipAddress}:${device.parent.port ?? '-'}`
        : '--';
  const parentProtocol = String(device.parent?.protocol ?? '').toLowerCase();
  const ownProtocol = String(device.protocol ?? '').toLowerCase();
  const protocolLabel = device.type === 'meter' && parentProtocol
    ? parentProtocol === 'tcp'
      ? 'TCP tunnel / Modbus RTU'
      : parentProtocol === 'udp'
        ? 'UDP tunnel / Modbus RTU'
        : parentProtocol === 'modbus_tcp'
          ? 'Modbus TCP'
          : parentProtocol === 'modbus_rtu'
            ? 'Modbus RTU'
            : device.protocol ?? '--'
    : ownProtocol === 'tcp'
      ? 'TCP'
      : ownProtocol === 'udp'
        ? 'UDP'
        : ownProtocol === 'modbus_tcp'
          ? 'Modbus TCP'
          : ownProtocol === 'modbus_rtu'
            ? 'Modbus RTU'
            : device.protocol ?? '--';
  const frequencyValues = deviceValues.filter(value => /frequency|hz/i.test(`${value.name} ${value.unit ?? ''}`));
  const statusRows = [
    ...(frequencyValues.length > 0 ? [{ label: 'Frequency stability', status: frequencyValues.every(value => value.quality === 'good') ? 'good' : 'warn' }] : []),
    { label: 'Communication', status: liveStatus.badge },
    { label: 'Tag quality', status: overallQuality },
    { label: 'Last read freshness', status: isFreshRead(latestReadAt) ? 'good' : 'warn' }
  ];
  const tabRows = rowsForDeviceTab(groups, activeTab);
  const generalRows = rowsForDeviceTab(groups, 'general');
  const summaryRows = generalRows.length > 0 ? generalRows : rowsForDeviceTab(groups, 'instantaneous').slice(0, 6);
  const tabs: Array<{ key: DeviceDetailTab; label: string }> = [
    { key: 'general', label: 'General' },
    { key: 'instantaneous', label: 'Instantaneous' },
    { key: 'maximum', label: 'Maximum' },
    { key: 'minimum', label: 'Minimum' },
    { key: 'energy', label: 'Energy' },
    { key: 'harmonics', label: 'Harmonics' },
    { key: 'status', label: 'Status' }
  ];

  return (
    <div className="view-page circutor-page">
      <div className="circutor-panel dash-animate dash-animate-delay-2">
        <div className="circutor-panel-toolbar">
          <button type="button" className="btn-outline toolbar-btn" onClick={onBack}>
            <ChevronLeft size={14} />
            Back to list
          </button>
          <StatusBadge status={liveStatus.badge} label={liveStatus.label} />
        </div>
        <div className="circutor-tabs">
          {tabs.map(tab => (
            <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="circutor-content" key={activeTab}>
          {activeTab === 'general' && (
            <div className="circutor-general">
              <fieldset className="device-hero-fieldset">
                <legend>Device</legend>
                <div className="device-hero-showcase">
                  <div className="device-hero-visual-wrap">
                    <div className="device-hero-glow" aria-hidden="true" />
                    <div className="device-hero-ring" aria-hidden="true" />
                    <DeviceAvatar device={device} size="showcase" className="device-avatar-showcase" />
                    <span className={`device-type-badge device-hero-badge ${device.type === 'converter' ? 'converter' : 'meter'}`}>
                      {device.type === 'converter' ? 'Converter' : 'Meter'}
                    </span>
                  </div>
                  <div className="device-hero-meta">
                    <h2 className="device-hero-name">{device.name}</h2>
                    {device.model && <p className="device-hero-model">{device.model}</p>}
                    <div className="device-hero-chips">
                      <span className="device-hero-chip">
                        <span className="device-hero-chip-label">Protocol</span>
                        <b>{protocolLabel}</b>
                      </span>
                      <span className="device-hero-chip">
                        <span className="device-hero-chip-label">Endpoint</span>
                        <b>{endpoint}</b>
                      </span>
                      <span className="device-hero-chip device-hero-chip-status">
                        <span className="device-hero-chip-label">Status</span>
                        <StatusBadge status={liveStatus.badge} label={liveStatus.label} />
                      </span>
                    </div>
                  </div>
                </div>
              </fieldset>
              <fieldset>
                <legend>Summary</legend>
                {renderCircutorTable(summaryRows.slice(0, 6), 'general')}
              </fieldset>
            </div>
          )}
          {activeTab === 'status' ? (
            <table className="circutor-table status-table">
              <thead><tr><th>Parameter</th><th>Status</th></tr></thead>
              <tbody>
                {statusRows.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td><StatusBadge status={row.status} label={qualityLabel(row.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab !== 'general' ? (
            renderCircutorTable(tabRows, activeTab)
          ) : null}
        </div>
      </div>
    </div>
  );
}


// English comment
function KpiCard({ label, value, note, valueClass }: { label: string; value: string; note: string; valueClass?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass ?? ''}`}>{value}</div>
      <div className="kpi-note">{note}</div>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

/** QA/build entry — runtime shell is MonitorShell (see main.tsx). */
export function App() {
  return null;
}
