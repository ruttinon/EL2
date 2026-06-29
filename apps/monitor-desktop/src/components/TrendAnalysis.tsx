import React from 'react';
import {
  TrendingUp,
  LineChart,
  AreaChart,
  BarChart3,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { engineApi } from '../api/engineApi';
import type { CurrentTagValue, RuntimeDevice, TrendPoint } from '../types/monitor';
import { EmptyPanel, ViewSearchInput } from './ViewHelpers';
import { FullscreenPanel } from './FullscreenPanel';
import { VirtualList } from './VirtualList';
import { buildDeviceHierarchyFromIndexes, countHierarchyTags } from '../utils/deviceTree';
import type { RuntimeIndexes } from '../utils/runtimeIndexes';
import { SCALE } from '../utils/scaleConfig';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

type ChartType = 'line' | 'area' | 'bar';
type DatePreset = 'last24h' | 'today' | 'last7d' | 'last30d' | 'thisMonth' | 'thisYear' | 'custom';

type TrendSeries = {
  tagId: string;
  tagName: string;
  deviceName: string;
  unit: string;
  color: string;
  points: TrendPoint[];
};

const SERIES_COLORS = [
  '#087c8b', '#0a94a0', '#f59e0b', '#ef4444', '#8b5cf6',
  '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
];

const DATE_PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'last24h', label: '24 Hours' },
  { key: 'last7d', label: '7 Days' },
  { key: 'last30d', label: '30 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'thisYear', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

function fmtVal(v: CurrentTagValue): string {
  if (v.value === null || v.value === undefined) return '--';
  const dp = v.decimalPlaces ?? 2;
  return `${Number(v.value).toFixed(dp)}${v.unit ? ` ${v.unit}` : ''}`;
}

function fmtDate(s?: string | null): string {
  if (!s) return '--';
  return new Date(s).toLocaleString();
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { from: string; to: string; fromMs: number; toMs: number } {
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);

  switch (preset) {
    case 'last24h':
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'today':
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      break;
    case 'last7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'thisMonth':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'thisYear':
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
      to = customTo ? new Date(customTo) : now;
      break;
  }

  return { from: from.toISOString(), to: to.toISOString(), fromMs: from.getTime(), toMs: to.getTime() };
}

function useChartSize(defaultHeight = 320) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 640, height: defaultHeight });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setSize({
        width: Math.max(el.clientWidth, 280),
        height: Math.max(el.clientHeight, 200),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    document.addEventListener('fullscreenchange', update);
    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', update);
    };
  }, []);

  return { ref, width: size.width, height: size.height };
}

function chartPadding(w: number) {
  const left = w < 480 ? 44 : 52;
  return { top: 20, right: 16, bottom: 36, left };
}

function MultiTrendChart({
  series,
  chartType,
  fromMs,
  toMs,
}: {
  series: TrendSeries[];
  chartType: ChartType;
  fromMs: number;
  toMs: number;
}) {
  const { ref, width: W, height: H } = useChartSize(320);
  const pad = chartPadding(W);
  const graphW = W - pad.left - pad.right;
  const graphH = H - pad.top - pad.bottom;
  const timeRange = toMs - fromMs || 1;

  const scaleX = (t: number) => pad.left + ((t - fromMs) / timeRange) * graphW;

  const allNums = series.flatMap(s =>
    s.points.map(p => p.value).filter((v): v is number => v !== null && v !== undefined),
  );

  if (allNums.length === 0) {
    return (
      <div className="trend-multi-chart-wrap trend-multi-chart-empty" ref={ref}>
        <EmptyPanel
          icon={<TrendingUp size={36} color="var(--chart-primary)" />}
          title="No data in selected range"
        />
      </div>
    );
  }

  const minVal = Math.min(...allNums);
  const maxVal = Math.max(...allNums);
  const valPad = (maxVal - minVal) * 0.08 || 1;
  const yMin = minVal - valPad;
  const yMax = maxVal + valPad;
  const valRange = yMax - yMin || 1;
  const scaleY = (v: number) => pad.top + graphH - ((v - yMin) / valRange) * graphH;

  const gridSteps = 4;
  const yTicks = Array.from({ length: gridSteps + 1 }, (_, i) => yMin + (i / gridSteps) * (yMax - yMin));

  const xLabels = 6;
  const xLabelTimes = Array.from({ length: xLabels }, (_, i) => fromMs + (i / (xLabels - 1)) * timeRange);

  const bucketCount = 40;

  function bucketPoints(points: TrendPoint[]): Array<{ t: number; v: number }> {
    const bucketMs = timeRange / bucketCount;
    const buckets = new Map<number, { sum: number; n: number }>();
    for (const p of points) {
      const t = new Date(p.readAt).getTime();
      if (t < fromMs || t > toMs || p.value === null || p.value === undefined) continue;
      const idx = Math.min(bucketCount - 1, Math.floor((t - fromMs) / bucketMs));
      const cur = buckets.get(idx) ?? { sum: 0, n: 0 };
      cur.sum += p.value;
      cur.n += 1;
      buckets.set(idx, cur);
    }
    return Array.from(buckets.entries())
      .map(([idx, { sum, n }]) => ({
        t: fromMs + (idx + 0.5) * bucketMs,
        v: sum / n,
      }))
      .sort((a, b) => a.t - b.t);
  }

  return (
    <div className="trend-multi-chart-wrap" ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="trend-chart-svg chart-line-animate trend-chart-draw"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        {yTicks.map((val, i) => {
          const y = scaleY(val);
          return (
            <g key={i}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} className="chart-grid-line" />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" className="chart-label-text" fontSize="10">
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}
        {xLabelTimes.map((t, i) => (
          <text
            key={i}
            x={scaleX(t)}
            y={H - 8}
            textAnchor="middle"
            className="chart-label-text"
            fontSize="9"
          >
            {new Date(t).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </text>
        ))}

        {series.map(s => {
          const valid = s.points.filter(p => p.value !== null && p.value !== undefined);
          if (valid.length === 0) return null;

          if (chartType === 'bar') {
            const buckets = bucketPoints(valid);
            const barW = (graphW / bucketCount) * 0.7 / series.length;
            const seriesIdx = series.indexOf(s);
            return buckets.map((b, i) => {
              const x = scaleX(b.t) - (barW * series.length) / 2 + seriesIdx * barW;
              const y = scaleY(b.v);
              const barH = pad.top + graphH - y;
              return (
                <rect
                  key={`${s.tagId}-b-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  fill={s.color}
                  opacity={0.85}
                  rx={2}
                />
              );
            });
          }

          const pts = valid
            .map(p => {
              const t = new Date(p.readAt).getTime();
              return `${scaleX(t).toFixed(1)},${scaleY(p.value as number).toFixed(1)}`;
            })
            .join(' ');

          if (chartType === 'area') {
            const first = valid[0]!;
            const last = valid[valid.length - 1]!;
            const areaPts = `${scaleX(new Date(first.readAt).getTime())},${pad.top + graphH} ${pts} ${scaleX(new Date(last.readAt).getTime())},${pad.top + graphH}`;
            return (
              <g key={s.tagId}>
                <polygon points={areaPts} fill={s.color} opacity={0.15} />
                <polyline
                  points={pts}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          }

          return (
            <polyline
              key={s.tagId}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export function TrendAnalysis({
  devices,
  currentValues,
  indexes,
}: {
  devices: RuntimeDevice[];
  currentValues: CurrentTagValue[];
  indexes: RuntimeIndexes;
}) {
  const now = new Date();
  const [tagSearch, setTagSearch] = React.useState('');
  const debouncedTagSearch = useDebouncedValue(tagSearch, 300);
  const [converterPage, setConverterPage] = React.useState(0);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(() => {
    const first = currentValues.find(v => v.historyEnabled) ?? currentValues[0];
    return first ? [first.id] : [];
  });
  const [datePreset, setDatePreset] = React.useState<DatePreset>('last24h');
  const [customFrom, setCustomFrom] = React.useState(() =>
    toLocalInputValue(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  );
  const [customTo, setCustomTo] = React.useState(() => toLocalInputValue(now));
  const [chartType, setChartType] = React.useState<ChartType>('area');
  const [series, setSeries] = React.useState<TrendSeries[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [collapsedDevices, setCollapsedDevices] = React.useState<Set<string>>(() => new Set());

  const tagById = React.useMemo(
    () => new Map(currentValues.map(v => [v.id, v])),
    [currentValues],
  );

  const range = resolveDateRange(datePreset, customFrom, customTo);

  const hierarchy = React.useMemo(
    () => buildDeviceHierarchyFromIndexes(indexes, devices, debouncedTagSearch),
    [indexes, devices, debouncedTagSearch],
  );

  const totalTagRows = React.useMemo(() => countHierarchyTags(hierarchy), [hierarchy]);
  const pageSize = SCALE.DEVICE_PAGE_SIZE;
  const converterPages = Math.max(1, Math.ceil(hierarchy.converters.length / pageSize));
  const currentConverterPage = Math.min(converterPage, converterPages - 1);
  const pagedConverters = hierarchy.converters.slice(
    currentConverterPage * pageSize,
    (currentConverterPage + 1) * pageSize,
  );
  const standalonePreview = debouncedTagSearch.trim()
    ? hierarchy.standalone
    : hierarchy.standalone.slice(0, pageSize);
  const standaloneTruncated =
    !debouncedTagSearch.trim() && hierarchy.standalone.length > pageSize;

  const autoCollapsedRef = React.useRef(false);

  React.useEffect(() => {
    setConverterPage(0);
  }, [debouncedTagSearch]);

  React.useEffect(() => {
    if (devices.length < SCALE.AUTO_COLLAPSE_DEVICES) return;
    if (autoCollapsedRef.current) return;
    autoCollapsedRef.current = true;
    const all = new Set<string>();
    for (const c of hierarchy.converters) {
      all.add(c.converter.id);
      for (const m of c.meters) all.add(m.device.id);
    }
    for (const s of hierarchy.standalone) all.add(s.device.id);
    setCollapsedDevices(all);
  }, [devices.length, hierarchy]);

  const hasTreeItems =
    hierarchy.converters.length > 0 || hierarchy.standalone.length > 0;

  function toggleTags(tags: CurrentTagValue[]) {
    const ids = tags.map(t => t.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedTagIds.includes(id));
    if (allSelected) {
      setSelectedTagIds(cur => cur.filter(id => !ids.includes(id)));
    } else {
      setSelectedTagIds(cur => [...new Set([...cur, ...ids])]);
    }
  }

  function renderTagRow(tag: CurrentTagValue) {
    const selected = selectedTagIds.includes(tag.id);
    return (
      <button
        key={tag.id}
        type="button"
        className={`trend-tag-check-item${selected ? ' active' : ''}`}
        onClick={() => toggleTag(tag.id)}
      >
        <span className="trend-tag-check">
          {selected ? <CheckSquare size={14} /> : <Square size={14} />}
        </span>
        <span className="trend-tag-name">{tag.name}</span>
        <span className="trend-tag-value">{fmtVal(tag)}</span>
        {!tag.historyEnabled && <span className="trend-tag-no-hist">no history</span>}
      </button>
    );
  }

  function renderTagRows(tags: CurrentTagValue[]) {
    if (tags.length > SCALE.TREND_VIRTUAL_THRESHOLD) {
      const listHeight = Math.min(360, tags.length * SCALE.TREND_TAG_ROW_HEIGHT);
      return (
        <VirtualList
          items={tags}
          height={listHeight}
          itemHeight={SCALE.TREND_TAG_ROW_HEIGHT}
          className="trend-tag-virtual-list"
          getKey={t => t.id}
          renderItem={t => renderTagRow(t)}
        />
      );
    }
    return tags.map(renderTagRow);
  }

  const loadTrends = React.useCallback(async () => {
    if (selectedTagIds.length === 0) {
      setSeries([]);
      setError('Select at least one tag to compare.');
      return;
    }
    setLoading(true);
    setError(undefined);
    const { from, to } = resolveDateRange(datePreset, customFrom, customTo);

    const results = await mapPool(
      selectedTagIds,
      SCALE.TREND_FETCH_CONCURRENCY,
      async (tagId, idx) => {
        const tag = tagById.get(tagId);
        const res = await engineApi.getTrend({ tagId, from, to, limit: 2000 });
        if (!res.ok) return { ok: false as const, tagId, message: res.message };
        return {
          ok: true as const,
          series: {
            tagId,
            tagName: tag?.name ?? res.data.values[0]?.tagName ?? tagId,
            deviceName: tag?.deviceName ?? res.data.values[0]?.deviceName ?? '',
            unit: tag?.unit ?? res.data.values[0]?.unit ?? '',
            color: SERIES_COLORS[idx % SERIES_COLORS.length],
            points: res.data.values,
          },
        };
      },
    );

    const failed = results.filter(r => !r.ok);
    const loaded = results.filter(r => r.ok).map(r => r.series!);
    setSeries(loaded);
    setLoading(false);
    if (failed.length > 0 && loaded.length === 0) {
      setError(failed.map(f => f.message).join('; '));
    } else if (failed.length > 0) {
      setError(`Some tags failed: ${failed.map(f => f.message).join('; ')}`);
    }
  }, [selectedTagIds, datePreset, customFrom, customTo, tagById]);

  React.useEffect(() => {
    const t = window.setTimeout(() => void loadTrends(), 200);
    return () => window.clearTimeout(t);
  }, [loadTrends]);

  function toggleTag(tagId: string) {
    setSelectedTagIds(cur =>
      cur.includes(tagId) ? cur.filter(id => id !== tagId) : [...cur, tagId],
    );
  }

  function toggleCollapse(deviceId: string) {
    setCollapsedDevices(cur => {
      const next = new Set(cur);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }

  const units = new Set(series.map(s => s.unit || '—'));
  const totalPoints = series.reduce((n, s) => n + s.points.length, 0);

  const chartTypes: Array<{ key: ChartType; label: string; icon: React.ReactNode }> = [
    { key: 'area', label: 'Area', icon: <AreaChart size={14} /> },
    { key: 'line', label: 'Line', icon: <LineChart size={14} /> },
    { key: 'bar', label: 'Bar', icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="view-page view-stack">
      <div className="card trend-controls-card dash-animate dash-animate-delay-1">
        {selectedTagIds.length > 0 && (
          <div className="card-header card-header--compact">
            <span />
            <span className="runtime-chip runtime-chip-teal">{selectedTagIds.length} tags selected</span>
          </div>
        )}
        <div className="trend-controls-body">
        <div className="trend-controls-section">
          <span className="trend-controls-label">Period</span>
          <div className="view-filter-tabs trend-preset-tabs">
            {DATE_PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                className={`view-filter-tab${datePreset === p.key ? ' active' : ''}`}
                onClick={() => setDatePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className="trend-custom-range dash-animate">
            <label className="trend-date-field">
              <span>From</span>
              <input
                type="datetime-local"
                className="view-search-input trend-date-input"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="trend-date-field">
              <span>To</span>
              <input
                type="datetime-local"
                className="view-search-input trend-date-input"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="trend-controls-row">
          <div className="trend-controls-section">
            <span className="trend-controls-label">Chart</span>
            <div className="chart-mode-toggle">
              {chartTypes.map(ct => (
                <button
                  key={ct.key}
                  type="button"
                  className={chartType === ct.key ? 'active' : ''}
                  onClick={() => setChartType(ct.key)}
                  title={ct.label}
                >
                  {ct.icon}
                  <span className="chart-mode-label">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn-primary toolbar-btn"
            onClick={() => void loadTrends()}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="spin-icon" /> : <TrendingUp size={14} />}
            {loading ? 'Loading…' : 'Refresh chart'}
          </button>
        </div>
        {selectedTagIds.length > SCALE.TREND_MAX_TAGS_WARNING && (
          <div className="alert warn view-alert trend-tags-warning">
            {selectedTagIds.length} tags selected — large comparisons may load slowly. Consider fewer tags per chart.
          </div>
        )}
        </div>
      </div>

      <ViewSearchInput
        value={tagSearch}
        onChange={setTagSearch}
        placeholder="Search devices or tags..."
      />

      <div className="trend-layout dash-animate dash-animate-delay-2">
        <div className="card trend-tags-card">
          <div className="card-header">
            <h3>Devices & Tags</h3>
            <span className="runtime-chip">{currentValues.length}</span>
          </div>
          <div className="trend-device-list">
            {!hasTreeItems
              ? <div className="empty-small">No tags match your search.</div>
              : (
                <>
                  {pagedConverters.map(group => {
                    const convId = group.converter.id;
                    const collapsed = collapsedDevices.has(convId);
                    const allConvTags = [
                      ...group.converterTags,
                      ...group.meters.flatMap(m => m.tags),
                    ];
                    const allSelected = allConvTags.length > 0 && allConvTags.every(t => selectedTagIds.includes(t.id));
                    const someSelected = allConvTags.some(t => selectedTagIds.includes(t.id));
                    return (
                      <div key={convId} className="trend-converter-group">
                        <div className="trend-converter-head">
                          <button
                            type="button"
                            className="trend-collapse-btn"
                            onClick={() => toggleCollapse(convId)}
                            aria-expanded={!collapsed}
                          >
                            {collapsed ? '▸' : '▾'}
                          </button>
                          <button
                            type="button"
                            className="trend-device-select-btn"
                            onClick={() => toggleTags(allConvTags)}
                            title="Select all under this converter"
                          >
                            {allSelected
                              ? <CheckSquare size={16} className="trend-check-icon on" />
                              : someSelected
                                ? <CheckSquare size={16} className="trend-check-icon partial" />
                                : <Square size={16} className="trend-check-icon" />}
                          </button>
                          <span className="device-type-badge converter">Converter</span>
                          <span className="trend-device-name">{group.converter.name}</span>
                          <span className="runtime-chip">{group.meters.length} meters</span>
                        </div>
                        {!collapsed && (
                          <>
                            {group.converterTags.length > 0 && (
                              <div className="trend-subsection">
                                <div className="trend-subsection-label">Converter signals</div>
                                {renderTagRows(group.converterTags)}
                              </div>
                            )}
                            {group.meters.map(meter => {
                              const meterId = meter.device.id;
                              const meterCollapsed = collapsedDevices.has(meterId);
                              const mAll = meter.tags.every(t => selectedTagIds.includes(t.id));
                              const mSome = meter.tags.some(t => selectedTagIds.includes(t.id));
                              return (
                                <div key={meterId} className="trend-meter-group">
                                  <div className="trend-meter-head">
                                    <button
                                      type="button"
                                      className="trend-collapse-btn"
                                      onClick={() => toggleCollapse(meterId)}
                                      aria-expanded={!meterCollapsed}
                                    >
                                      {meterCollapsed ? '▸' : '▾'}
                                    </button>
                                    <button
                                      type="button"
                                      className="trend-device-select-btn"
                                      onClick={() => toggleTags(meter.tags)}
                                      title="Select all meter tags"
                                    >
                                      {mAll
                                        ? <CheckSquare size={14} className="trend-check-icon on" />
                                        : mSome
                                          ? <CheckSquare size={14} className="trend-check-icon partial" />
                                          : <Square size={14} className="trend-check-icon" />}
                                    </button>
                                    <span className="device-type-badge meter">Meter</span>
                                    <span className="trend-meter-name">{meter.device.name}</span>
                                    <span className="runtime-chip">{meter.tags.length}</span>
                                  </div>
                                  {!meterCollapsed && renderTagRows(meter.tags)}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {hierarchy.converters.length > pageSize && (
                    <div className="pagination-row">
                      <button
                        type="button"
                        className="btn-outline toolbar-btn"
                        disabled={currentConverterPage <= 0}
                        onClick={() => setConverterPage(p => Math.max(0, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="pagination-label">
                        Converters {currentConverterPage + 1} / {converterPages}
                      </span>
                      <button
                        type="button"
                        className="btn-outline toolbar-btn"
                        disabled={currentConverterPage >= converterPages - 1}
                        onClick={() => setConverterPage(p => Math.min(converterPages - 1, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  {standalonePreview.map(node => {
                    const id = node.device.id;
                    const collapsed = collapsedDevices.has(id);
                    const allSelected = node.tags.every(t => selectedTagIds.includes(t.id));
                    const someSelected = node.tags.some(t => selectedTagIds.includes(t.id));
                    return (
                      <div key={id} className="trend-device-group">
                        <div className="trend-device-head">
                          <button
                            type="button"
                            className="trend-collapse-btn"
                            onClick={() => toggleCollapse(id)}
                            aria-expanded={!collapsed}
                          >
                            {collapsed ? '▸' : '▾'}
                          </button>
                          <button
                            type="button"
                            className="trend-device-select-btn"
                            onClick={() => toggleTags(node.tags)}
                          >
                            {allSelected
                              ? <CheckSquare size={16} className="trend-check-icon on" />
                              : someSelected
                                ? <CheckSquare size={16} className="trend-check-icon partial" />
                                : <Square size={16} className="trend-check-icon" />}
                          </button>
                          <span className="device-type-badge standalone">{node.device.type}</span>
                          <span className="trend-device-name">{node.device.name}</span>
                          <span className="runtime-chip">{node.tags.length}</span>
                        </div>
                        {!collapsed && renderTagRows(node.tags)}
                      </div>
                    );
                  })}
                </>
              )}
          </div>
        </div>

        <div className="card trend-chart-card">
          <div className="card-header">
            <h3>
              {series.length > 0
                ? `Comparison · ${series.length} series`
                : 'Trend Chart'}
            </h3>
            {totalPoints > 0 && <span className="runtime-chip">{totalPoints} points</span>}
          </div>
          <div className="trend-chart-wrap">
            {error && <div className="alert warn view-alert">{error}</div>}
            {units.size > 1 && (
              <div className="alert info view-alert">
                Multiple units detected — compare similar measurements for accurate comparison.
              </div>
            )}
            {loading && series.length === 0 ? (
              <div className="trend-loading">
                <Loader2 size={28} className="spin-icon" />
                <span>Loading trend data…</span>
              </div>
            ) : series.length === 0 ? (
              <EmptyPanel
                icon={<TrendingUp size={36} color="var(--chart-primary)" />}
                title="Select tags to compare"
              />
            ) : (
              <>
                <div className="trend-legend">
                  {series.map(s => {
                    const vals = s.points.map(p => p.value).filter((v): v is number => v != null);
                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                    return (
                      <div key={s.tagId} className="trend-legend-item">
                        <span className="trend-legend-dot" style={{ background: s.color }} />
                        <span className="trend-legend-label">
                          <b>{s.deviceName}</b> / {s.tagName}
                        </span>
                        <span className="trend-legend-stat">
                          avg {avg.toFixed(2)} {s.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <FullscreenPanel className="trend-chart-fullscreen" label="Fullscreen chart">
                  <MultiTrendChart
                    series={series}
                    chartType={chartType}
                    fromMs={range.fromMs}
                    toMs={range.toMs}
                  />
                </FullscreenPanel>
              </>
            )}
          </div>
        </div>
      </div>

      {series.length > 0 && totalPoints > 0 && (
        <div className="card dash-animate dash-animate-delay-3">
          <div className="card-header">
            <h3>Raw Data</h3>
            <span className="runtime-chip">{totalPoints} points</span>
          </div>
          <div className="table-scroll-wrap">
            <table className="data-table data-table-modern">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Device</th>
                  <th>Tag</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {series
                  .flatMap(s =>
                    s.points.map(p => ({ ...p, seriesColor: s.color })),
                  )
                  .sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime())
                  .slice(0, SCALE.TREND_RAW_TABLE_ROWS)
                  .map((p, i) => (
                    <tr key={`${p.id}-${i}`} className="table-row-animate" style={{ animationDelay: `${Math.min(i, 12) * 0.01}s` }}>
                      <td className="cell-muted">{fmtDate(p.readAt)}</td>
                      <td>{p.deviceName}</td>
                      <td>
                        <span className="trend-table-tag">
                          <span className="trend-legend-dot" style={{ background: p.seriesColor }} />
                          {p.tagName}
                        </span>
                      </td>
                      <td><b>{p.value?.toFixed(2) ?? '--'}</b></td>
                      <td>{p.unit ?? '--'}</td>
                      <td><span className={`status-badge ${p.quality}`}>{p.quality}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
