import React from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

type HistoryPoint = { time: string; value: number };

function useChartSize(height = 260) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(640);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(el.clientWidth, 320));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width, height };
}

function chartPadding(w: number) {
  const left = w < 480 ? 40 : 48;
  return { top: 16, right: 12, bottom: 28, left };
}

function xAt(index: number, count: number, pad: ReturnType<typeof chartPadding>, graphW: number) {
  if (count <= 1) return pad.left + graphW;
  return pad.left + (index / (count - 1)) * graphW;
}

function yScale(values: number[], graphH: number, padTop: number) {
  const max = Math.max(...values, 0);
  const minVal = 0;
  const maxVal = max > 0 ? max * 1.12 : 1;
  const range = maxVal - minVal;
  const getY = (v: number) => padTop + graphH - ((v - minVal) / range) * graphH;
  return { minVal, maxVal, range, getY };
}

function donutRingPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
) {
  if (endAngle - startAngle < 0.001) return '';
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
}

function linePathFromPoints(points: string): string {
  const pairs = points.trim().split(/\s+/).filter(Boolean);
  if (pairs.length === 0) return '';
  const [x0, y0] = pairs[0].split(',').map(Number);
  const rest = pairs.slice(1).map(p => {
    const [x, y] = p.split(',').map(Number);
    return `L ${x} ${y}`;
  });
  return `M ${x0} ${y0} ${rest.join(' ')}`;
}

function pathLengthEstimate(d: string): number {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let len = 0;
  for (let i = 2; i < nums.length; i += 2) {
    const dx = nums[i] - nums[i - 2];
    const dy = nums[i + 1] - nums[i - 1];
    len += Math.hypot(dx, dy);
  }
  return Math.max(len, 1);
}

function useStrokeDraw(pathD: string, active: boolean, duration = 1100) {
  const [offset, setOffset] = React.useState(0);
  const hasDrawnRef = React.useRef(false);
  const len = pathLengthEstimate(pathD);

  React.useEffect(() => {
    if (!active || !pathD) {
      setOffset(0);
      return;
    }
    if (hasDrawnRef.current) {
      setOffset(0);
      return;
    }
    hasDrawnRef.current = true;
    setOffset(len);
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setOffset(len * (1 - eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathD, active, len, duration]);

  return { strokeDasharray: len, strokeDashoffset: offset };
}

type ChartMode = 'line' | 'area' | 'bar';

export function PowerTrendChart({ history }: { history: HistoryPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<ChartMode>('area');
  const { ref, width: W, height: H } = useChartSize(280);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const activeHistory = history ?? [];
  const pad = chartPadding(W);
  const graphW = W - pad.left - pad.right;
  const graphH = H - pad.top - pad.bottom;
  const values = activeHistory.length > 0 ? activeHistory.map(h => h.value) : [0];
  const { minVal, maxVal, getY } = yScale(values, graphH, pad.top);
  const count = activeHistory.length;
  const currentVal = values[values.length - 1] ?? 0;
  const animatedCurrent = useAnimatedNumber(currentVal, 400, 0.05);

  const points = activeHistory.map((h, i) => `${xAt(i, count, pad, graphW).toFixed(1)},${getY(h.value).toFixed(1)}`).join(' ');
  const lineD = linePathFromPoints(points);
  const strokeDraw = useStrokeDraw(lineD, mode !== 'bar' && count > 1);
  const areaPoints = count > 0
    ? `${pad.left},${pad.top + graphH} ${points} ${xAt(count - 1, count, pad, graphW).toFixed(1)},${pad.top + graphH}`
    : '';

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || count < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const approxIdx = ((svgX - pad.left) / graphW) * (count - 1);
    setHoveredIdx(Math.max(0, Math.min(count - 1, Math.round(approxIdx))));
  };

  const gridSteps = 4;
  const yTicks = Array.from({ length: gridSteps + 1 }, (_, i) => minVal + (i / gridSteps) * (maxVal - minVal));

  return (
    <div className="dashboard-chart-container chart-depth dash-animate dash-animate-delay-3">
      <div className="dashboard-chart-header">
        <div>
          <span className="dashboard-chart-title">Real-Time Power Trend</span>
        </div>
        <div className="dashboard-chart-header-right">
          <div className="chart-mode-toggle">
            {(['area', 'line', 'bar'] as ChartMode[]).map(m => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'active' : ''}
                onClick={() => setMode(m)}
              >
                {m === 'area' ? 'Area' : m === 'line' ? 'Line' : 'Bar'}
              </button>
            ))}
          </div>
          <div className="dashboard-chart-current">
            <span className="value dash-count-pulse">{animatedCurrent.toFixed(2)}</span> <span className="unit">kW</span>
          </div>
        </div>
      </div>
      <div className="dashboard-chart-body chart-body-glow" ref={ref}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="dashboard-svg-chart chart-svg-lift"
          preserveAspectRatio="none"
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="powerAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="barShineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
              <stop offset="55%" stopColor="#fff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} className="chart-grid-line" />
                <text x={pad.left - 6} y={y + 3} textAnchor="end" className="chart-label-text" fontSize="10">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}
          {mode === 'bar' && activeHistory.map((h, i) => {
            const barW = count > 0 ? (graphW / Math.max(count, 1)) * 0.65 : 0;
            const x = count <= 1
              ? pad.left + graphW - barW
              : pad.left + (i / Math.max(count - 1, 1)) * graphW - barW / 2;
            const y = getY(h.value);
            const barH = pad.top + graphH - y;
            return (
              <g key={i} className="chart-bar-group" style={{ animationDelay: `${i * 0.04}s` }}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={3}
                  className="chart-bar-fill chart-bar-animate"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={3}
                  fill="url(#barShineGrad)"
                  className="chart-bar-shine"
                />
              </g>
            );
          })}
          {mode === 'area' && areaPoints && <polygon points={areaPoints} fill="url(#powerAreaGrad)" className="chart-area-animate" />}
          {(mode === 'line' || mode === 'area') && lineD && (
            <path
              d={lineD}
              className="chart-line chart-line-draw"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={strokeDraw}
            />
          )}
          {count > 0 && hoveredIdx === null && (
            <g className="chart-live-dot">
              <circle cx={xAt(count - 1, count, pad, graphW)} cy={getY(currentVal)} r="4" className="chart-dot" />
              <circle cx={xAt(count - 1, count, pad, graphW)} cy={getY(currentVal)} r="9" className="chart-dot-pulse" />
            </g>
          )}
          {hoveredIdx !== null && activeHistory[hoveredIdx] && (
            <g>
              <line
                x1={xAt(hoveredIdx, count, pad, graphW)}
                y1={pad.top}
                x2={xAt(hoveredIdx, count, pad, graphW)}
                y2={pad.top + graphH}
                className="chart-hover-line"
              />
              <circle
                cx={xAt(hoveredIdx, count, pad, graphW)}
                cy={getY(activeHistory[hoveredIdx].value)}
                r="5"
                className="chart-dot"
              />
            </g>
          )}
        </svg>
        {hoveredIdx !== null && activeHistory[hoveredIdx] && (
          <div
            className="chart-tooltip dash-tooltip-in"
            style={{
              left: `${(xAt(hoveredIdx, count, pad, graphW) / W) * 100}%`,
              top: `${(getY(activeHistory[hoveredIdx].value) / H) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <span className="chart-tooltip-time">
              {new Date(activeHistory[hoveredIdx].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="chart-tooltip-value">
              {activeHistory[hoveredIdx].value.toFixed(2)} <span className="unit">kW</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DevicePowerBarChart({ items }: { items: Array<{ name: string; value: number }> }) {
  const { ref, width: W, height: H } = useChartSize(220);
  const pad = { top: 12, right: 12, bottom: 36, left: 44 };
  const graphW = W - pad.left - pad.right;
  const graphH = H - pad.top - pad.bottom;
  const data = items.slice(0, 8);
  const max = Math.max(...data.map(d => d.value), 0.1);
  const barGap = 8;
  const barW = data.length > 0 ? (graphW - barGap * (data.length - 1)) / data.length : 0;

  return (
    <div className="dashboard-chart-container dashboard-chart-compact chart-depth dash-animate dash-animate-delay-4">
      <div className="dashboard-chart-header">
        <div>
          <span className="dashboard-chart-title">Energy by Device</span>
        </div>
      </div>
      <div className="dashboard-chart-body chart-body-glow" ref={ref}>
        {data.length === 0 ? (
          <div className="dashboard-chart-empty">No device power data</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="dashboard-svg-chart chart-svg-lift" preserveAspectRatio="none">
            <defs>
              <linearGradient id="deviceBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-primary-soft)" />
                <stop offset="100%" stopColor="var(--chart-primary)" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((p, i) => {
              const val = max * p;
              const y = pad.top + graphH - p * graphH;
              return (
                <g key={i}>
                  <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} className="chart-grid-line" />
                  <text x={pad.left - 6} y={y + 3} textAnchor="end" className="chart-label-text" fontSize="9">{val.toFixed(1)}</text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const h = (d.value / max) * graphH;
              const x = pad.left + i * (barW + barGap);
              const y = pad.top + graphH - h;
              const label = d.name.length > 10 ? d.name.slice(0, 9) + '…' : d.name;
              return (
                <g key={d.name} className="chart-bar-group" style={{ animationDelay: `${i * 0.06}s` }}>
                  <rect x={x} y={y} width={barW} height={h} rx={4} fill="url(#deviceBarGrad)" className="chart-bar-fill chart-bar-animate" />
                  <rect x={x} y={y} width={barW} height={h} rx={4} className="chart-bar-shine" />
                  <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="chart-label-text" fontSize="9">{label}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

const STATUS_SLICES = [
  { key: 'online', color: 'var(--green)', label: 'Online' },
  { key: 'warning', color: 'var(--amber)', label: 'Warning' },
  { key: 'offline', color: 'var(--red)', label: 'Offline' },
] as const;

export function DeviceStatusDonut({
  online,
  warning,
  offline,
}: {
  online: number;
  warning: number;
  offline: number;
}) {
  const counts = { online, warning, offline };
  const total = online + warning + offline;
  const animatedTotal = useAnimatedNumber(total, 800);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 72;
  const innerR = 48;

  let angle = -Math.PI / 2;
  const arcs = STATUS_SLICES.map((slice, idx) => {
    const value = counts[slice.key];
    const portion = total > 0 ? value / total : 0;
    const sweep = portion * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const path = value > 0 && total > 0
      ? donutRingPath(cx, cy, outerR, innerR, start, end)
      : '';
    return { ...slice, value, path, idx };
  });

  return (
    <div className="dashboard-chart-container dashboard-donut-card chart-depth dash-animate dash-animate-delay-5">
      <div className="dashboard-chart-header">
        <div>
          <span className="dashboard-chart-title">Device Status</span>
        </div>
      </div>
      <div className="dashboard-chart-body donut-card-body">
        <div className="donut-chart-wrap donut-pop-in donut-float-subtle donut-chart-premium">
          <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg-full chart-svg-lift" aria-hidden="true">
            <g className="donut-orbit-group" style={{ transformOrigin: `${cx}px ${cy}px` }}>
              <circle
                cx={cx}
                cy={cy}
                r={outerR + 14}
                fill="none"
                stroke="var(--teal-600)"
                strokeWidth="1"
                strokeDasharray="4 9"
                opacity="0.28"
                className="donut-orbit-ring"
              />
              <circle
                cx={cx}
                cy={cy}
                r={outerR + 8}
                fill="none"
                stroke="var(--chart-primary-soft)"
                strokeWidth="1"
                strokeDasharray="2 12"
                opacity="0.4"
                className="donut-orbit-ring donut-orbit-ring--reverse"
              />
            </g>
            <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--line)" strokeWidth={outerR - innerR} opacity="0.45" />
            {arcs.map(a => a.path && (
              <path
                key={a.key}
                d={a.path}
                fill={a.color}
                className="donut-segment-animate donut-segment-live"
                style={{ animationDelay: `${a.idx * 0.14}s` }}
              />
            ))}
            <text x={cx} y={cy - 6} textAnchor="middle" className="donut-center-value dash-count-pulse">
              {Math.round(animatedTotal)}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="donut-center-label">devices</text>
          </svg>
        </div>
        <div className="donut-legend-grid">
          {STATUS_SLICES.map(slice => (
            <div key={slice.key} className="donut-legend-pill dash-animate" style={{ animationDelay: `${0.2 + STATUS_SLICES.findIndex(s => s.key === slice.key) * 0.08}s` }}>
              <span className="donut-legend-dot donut-legend-pulse" style={{ background: slice.color }} />
              <span className="donut-legend-label">{slice.label}</span>
              <b className="donut-legend-count">{counts[slice.key]}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CommunicationDonut({ quality }: { quality: number }) {
  const pct = Math.max(0, Math.min(100, quality));
  const animatedPct = useAnimatedNumber(pct, 900);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 72;
  const strokeW = 22;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct > 80 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : pct > 0 ? 'var(--red)' : 'var(--line)';

  return (
    <div className="dashboard-chart-container dashboard-donut-card chart-depth dash-animate dash-animate-delay-6">
      <div className="dashboard-chart-header">
        <div>
          <span className="dashboard-chart-title">Signal Quality</span>
        </div>
      </div>
      <div className="dashboard-chart-body donut-card-body">
        <div className="donut-chart-wrap donut-pop-in donut-float-subtle donut-chart-premium">
          <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg-full chart-svg-lift" aria-hidden="true">
            <g className="donut-orbit-group" style={{ transformOrigin: `${cx}px ${cy}px` }}>
              <circle
                cx={cx}
                cy={cy}
                r={r + 16}
                fill="none"
                stroke="var(--teal-600)"
                strokeWidth="1"
                strokeDasharray="5 8"
                opacity="0.3"
                className="donut-orbit-ring"
              />
              <circle
                cx={cx}
                cy={cy}
                r={r + 9}
                fill="none"
                stroke="var(--chart-primary-soft)"
                strokeWidth="1"
                strokeDasharray="2 10"
                opacity="0.45"
                className="donut-orbit-ring donut-orbit-ring--reverse"
              />
            </g>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--line)"
              strokeWidth={strokeW}
              opacity="0.5"
            />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="gauge-ring-progress gauge-ring-draw gauge-ring-live"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <text x={cx} y={cy - 4} textAnchor="middle" className="donut-center-value dash-count-pulse">
              {Math.round(animatedPct)}%
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" className="donut-center-label">quality</text>
          </svg>
        </div>
        <div className="signal-quality-bars">
          <div className="signal-quality-track">
            <div className="signal-quality-fill gauge-bar-animate" style={{ width: `${pct}%`, background: color }} />
            <div className="signal-quality-shimmer" style={{ width: `${pct}%` }} />
          </div>
          <div className="signal-quality-labels">
            <span>Poor</span>
            <span>Good</span>
          </div>
        </div>
      </div>
    </div>
  );
}
