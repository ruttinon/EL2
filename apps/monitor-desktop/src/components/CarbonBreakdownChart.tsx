import React from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import type { CarbonBreakdownResponse } from '../api/engineApi';

const COLORS = [
  'var(--teal-600)',
  'var(--amber)',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#8b5cf6',
];

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

type CarbonBreakdownChartProps = {
  breakdown?: CarbonBreakdownResponse;
  loading?: boolean;
};

export function CarbonBreakdownChart({ breakdown, loading }: CarbonBreakdownChartProps) {
  const items = breakdown?.items ?? [];
  const totalKwh = breakdown?.totalKwh ?? 0;
  const animatedTotal = useAnimatedNumber(totalKwh, 800);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 72;
  const innerR = 48;

  let angle = -Math.PI / 2;
  const arcs = items.slice(0, 6).map((item, idx) => {
    const portion = totalKwh > 0 ? item.kWh / totalKwh : 0;
    const sweep = portion * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return {
      ...item,
      color: COLORS[idx % COLORS.length],
      path: item.kWh > 0 && totalKwh > 0 ? donutRingPath(cx, cy, outerR, innerR, start, end) : '',
      idx,
    };
  });

  const byLabel =
    breakdown?.by === 'device' ? 'by device' : breakdown?.by === 'source' ? 'by source' : 'by load category';

  return (
    <div className="dashboard-chart-container dashboard-donut-card chart-depth dash-animate dash-animate-delay-5">
      <div className="dashboard-chart-header">
        <div>
          <span className="dashboard-chart-title">Carbon Breakdown</span>
          <span className="dashboard-chart-subtitle">{byLabel} · kWh qualified</span>
        </div>
      </div>
      <div className="dashboard-chart-body donut-card-body">
        {loading ? (
          <div className="carbon-breakdown-empty">Loading breakdown…</div>
        ) : items.length === 0 ? (
          <div className="carbon-breakdown-empty">
            No breakdown data yet. Set sub-meter load categories or import tags.
          </div>
        ) : (
          <>
            <div className="donut-chart-wrap donut-pop-in donut-float-subtle donut-chart-premium">
              <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg-full chart-svg-lift" aria-hidden="true">
                <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--line)" strokeWidth={outerR - innerR} opacity="0.45" />
                {arcs.map(a => a.path && (
                  <path
                    key={a.key}
                    d={a.path}
                    fill={a.color}
                    className="donut-segment-animate donut-segment-live"
                    style={{ animationDelay: `${a.idx * 0.12}s` }}
                  />
                ))}
                <text x={cx} y={cy - 6} textAnchor="middle" className="donut-center-value dash-count-pulse">
                  {animatedTotal.toFixed(0)}
                </text>
                <text x={cx} y={cy + 14} textAnchor="middle" className="donut-center-label">kWh</text>
              </svg>
            </div>
            <div className="donut-legend-grid">
              {arcs.map(slice => (
                <div key={slice.key} className="donut-legend-pill dash-animate">
                  <span className="donut-legend-dot" style={{ background: slice.color }} />
                  <span className="donut-legend-label">{slice.label}</span>
                  <b className="donut-legend-count">
                    {slice.kWh.toFixed(1)} kWh · {slice.carbonKg.toFixed(1)} kg
                  </b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
