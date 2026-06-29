import React from 'react';
import type { TrendPoint } from './types';

function filterPoints(pts: TrendPoint[]) {
  return pts.filter((p) => p.value != null && Number.isFinite(Number(p.value)));
}

export function MiniTrendChart({
  points,
  title,
  unit,
  showAxes = true,
  emptyLabel,
  showPointMarkers = false,
}: {
  points: TrendPoint[];
  title?: string;
  unit?: string;
  showAxes?: boolean;
  emptyLabel?: string;
  showPointMarkers?: boolean;
}) {
  const pts = filterPoints(points);
  if (pts.length === 0) {
    return (
      <div className="rt-chart-empty">
        {title && <div className="rt-obj-name">{title}</div>}
        <span className="rt-chart-no-data">{emptyLabel ?? 'ยังไม่มีข้อมูลแนวโน้ม'}</span>
      </div>
    );
  }
  if (pts.length === 1) {
    const v = Number(pts[0]!.value);
    return (
      <div className="rt-chart-empty">
        {title && <div className="rt-obj-name">{title}</div>}
        <span className="rt-chart-no-data">{emptyLabel ?? `กำลังเก็บข้อมูล… (${v.toFixed(2)}${unit ? ` ${unit}` : ''})`}</span>
      </div>
    );
  }

  const vals = pts.map((p) => Number(p.value));
  const times = pts.map((p) => new Date(p.readAt).getTime());
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const vRange = maxV - minV || 1;
  const tRange = (times[times.length - 1] ?? 0) - (times[0] ?? 0) || 1;
  const pad = showAxes ? { t: 18, r: 8, b: 22, l: 36 } : { t: 6, r: 4, b: 4, l: 4 };
  const W = 100;
  const H = 100;
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const sx = (t: number) => pad.l + ((t - (times[0] ?? 0)) / tRange) * cW;
  const sy = (v: number) => pad.t + cH - ((v - minV) / vRange) * cH;
  const polyPts = pts
    .map((p) => `${sx(new Date(p.readAt).getTime()).toFixed(2)},${sy(Number(p.value)).toFixed(2)}`)
    .join(' ');
  const fillPts = `${pad.l},${pad.t + cH} ${polyPts} ${sx(times[times.length - 1]!).toFixed(2)},${pad.t + cH}`;

  return (
    <div className="rt-trend-wrap">
      {title && <div className="rt-obj-name">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="rt-trend-svg" preserveAspectRatio="none">
        {showAxes && (
          <>
            <line x1={pad.l} y1={pad.t + cH} x2={W - pad.r} y2={pad.t + cH} stroke="#e2edf2" strokeWidth="0.5" />
            <text x={pad.l - 2} y={pad.t + 8} textAnchor="end" fontSize="5" fill="#94a3b8">
              {maxV.toFixed(1)}
            </text>
            <text x={pad.l - 2} y={pad.t + cH} textAnchor="end" fontSize="5" fill="#94a3b8">
              {minV.toFixed(1)}
            </text>
          </>
        )}
        <polygon points={fillPts} fill="var(--chart-primary, #087c8b)" opacity="0.12" />
        <polyline
          points={polyPts}
          fill="none"
          stroke="var(--chart-primary, #087c8b)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {showPointMarkers
          ? pts.map((p, i) => (
            <circle
              key={`${p.readAt}-${i}`}
              cx={sx(new Date(p.readAt).getTime())}
              cy={sy(Number(p.value))}
              r="1.8"
              fill="var(--chart-primary, #087c8b)"
            />
          ))
          : null}
        {unit && showAxes && (
          <text x={W - pad.r} y={pad.t + 8} textAnchor="end" fontSize="5" fill="#94a3b8">
            {unit}
          </text>
        )}
      </svg>
    </div>
  );
}

const TREND_SERIES_COLORS = ['#087c8b', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#06b6d4'];

export type TrendSeries = {
  label: string;
  color: string;
  points: TrendPoint[];
};

export function MultiTrendChart({
  series,
  title,
  showLegend = true,
  emptyLabel,
}: {
  series: TrendSeries[];
  title?: string;
  showLegend?: boolean;
  emptyLabel?: string;
}) {
  const filtered = series.map((s) => ({ ...s, pts: filterPoints(s.points) }));
  const drawable = filtered.filter((s) => s.pts.length >= 2);
  if (drawable.length === 0) {
    const anyPts = filtered.some((s) => s.pts.length === 1);
    return (
      <div className="rt-chart-empty">
        {title && <div className="rt-obj-name">{title}</div>}
        <span className="rt-chart-no-data">
          {emptyLabel ?? (anyPts ? 'กำลังเก็บข้อมูลแนวโน้ม…' : 'ยังไม่มีข้อมูลแนวโน้ม')}
        </span>
      </div>
    );
  }

  const allVals = drawable.flatMap((s) => s.pts.map((p) => Number(p.value)));
  const allTimes = filtered.flatMap((s) => s.pts.map((p) => new Date(p.readAt).getTime()));
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const vRange = maxV - minV || 1;
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const tRange = maxT - minT || 1;
  const pad = { t: 18, r: 8, b: 22, l: 36 };
  const W = 100;
  const H = 100;
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const sx = (t: number) => pad.l + ((t - minT) / tRange) * cW;
  const sy = (v: number) => pad.t + cH - ((v - minV) / vRange) * cH;

  return (
    <div className="rt-trend-wrap rt-multi-trend-wrap">
      {title && <div className="rt-obj-name">{title}</div>}
      {showLegend && drawable.length > 1 && (
        <div className="rt-trend-legend">
          {drawable.map((s) => (
            <span key={s.label} className="rt-trend-legend-item">
              <span className="rt-trend-legend-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="rt-trend-svg" preserveAspectRatio="none">
        <line x1={pad.l} y1={pad.t + cH} x2={W - pad.r} y2={pad.t + cH} stroke="#e2edf2" strokeWidth="0.5" />
        <text x={pad.l - 2} y={pad.t + 8} textAnchor="end" fontSize="5" fill="#94a3b8">{maxV.toFixed(1)}</text>
        <text x={pad.l - 2} y={pad.t + cH} textAnchor="end" fontSize="5" fill="#94a3b8">{minV.toFixed(1)}</text>
        {drawable.map((s) => {
          const polyPts = s.pts
            .map((p) => `${sx(new Date(p.readAt).getTime()).toFixed(2)},${sy(Number(p.value)).toFixed(2)}`)
            .join(' ');
          return (
            <polyline
              key={s.label}
              points={polyPts}
              fill="none"
              stroke={s.color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}

export { TREND_SERIES_COLORS };

export function SparklineChart({ points }: { points: TrendPoint[] }) {
  const pts = filterPoints(points);
  if (pts.length < 2) {
    return <div className="rt-sparkline-empty" />;
  }
  const vals = pts.map((p) => Number(p.value));
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const W = 100;
  const H = 32;
  const polyPts = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - ((v - minV) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rt-sparkline-svg" preserveAspectRatio="none">
      <polyline points={polyPts} fill="none" stroke="var(--chart-primary, #087c8b)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MiniBarChart({
  items,
  title,
}: {
  items: Array<{ label: string; value: number; unit?: string }>;
  title?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="rt-barchart-wrap">
      {title && <div className="rt-obj-name">{title}</div>}
      <div className="rt-barchart-rows">
        {items.map((item) => (
          <div key={item.label} className="rt-barchart-row">
            <span className="rt-barchart-label">{item.label}</span>
            <div className="rt-barchart-track">
              <div className="rt-barchart-fill" style={{ width: `${(item.value / max) * 100}%`, background: 'var(--chart-primary, #087c8b)' }} />
            </div>
            <span className="rt-barchart-val">
              {item.value.toFixed(1)}
              {item.unit ? ` ${item.unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SvgGauge({
  value,
  min = 0,
  max = 100,
  unit,
  arcColor = '#087c8b',
  trackColor = '#d1e8ec',
}: {
  value: number | null | undefined;
  min?: number;
  max?: number;
  unit?: string | null;
  arcColor?: string;
  trackColor?: string;
}) {
  const pct = value === null || value === undefined ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  const r = 38;
  const cx = 50;
  const cy = 54;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const arcX = (a: number) => cx + r * Math.cos(rad(a));
  const arcY = (a: number) => cy + r * Math.sin(rad(a));
  const startA = -135;
  const endA = startA + pct * 270;
  const largeArc = pct * 270 > 180 ? 1 : 0;

  return (
    <svg viewBox="0 0 100 70" className="rt-gauge-svg" style={{ overflow: 'visible' }}>
      <path
        d={`M${arcX(-135)} ${arcY(-135)} A${r} ${r} 0 1 1 ${arcX(135)} ${arcY(135)}`}
        fill="none"
        stroke={trackColor}
        strokeWidth="8"
        strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={`M${arcX(startA)} ${arcY(startA)} A${r} ${r} 0 ${largeArc} 1 ${arcX(endA)} ${arcY(endA)}`}
          fill="none"
          stroke={arcColor}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="900" fill={arcColor}>
        {value === null || value === undefined ? '--' : Number(value).toFixed(1)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="var(--muted, #6b7c8c)">
        {unit ?? ''}
      </text>
    </svg>
  );
}

const PIE_COLORS = ['#087c8b', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#06b6d4', '#ec4899'];

export function MiniPieChart({
  items,
  title,
  donut = false,
}: {
  items: Array<{ label: string; value: number }>;
  title?: string;
  donut?: boolean;
}) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  if (total <= 0) {
    return (
      <div className="rt-piechart-wrap">
        {title && <div className="rt-obj-name">{title}</div>}
        <span className="rt-chart-no-data">No data</span>
      </div>
    );
  }
  let angle = -90;
  const cx = 50;
  const cy = 50;
  const r = 40;
  const ir = donut ? 22 : 0;
  const slices = items.map((item, i) => {
    const frac = Math.max(0, item.value) / total;
    const sweep = frac * 360;
    const start = angle;
    angle += sweep;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(start));
    const y1 = cy + r * Math.sin(rad(start));
    const x2 = cx + r * Math.cos(rad(start + sweep));
    const y2 = cy + r * Math.sin(rad(start + sweep));
    const large = sweep > 180 ? 1 : 0;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    if (donut && ir > 0) {
      const ix1 = cx + ir * Math.cos(rad(start));
      const iy1 = cy + ir * Math.sin(rad(start));
      const ix2 = cx + ir * Math.cos(rad(start + sweep));
      const iy2 = cy + ir * Math.sin(rad(start + sweep));
      return (
        <path
          key={item.label}
          d={`M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`}
          fill={color}
        />
      );
    }
    return (
      <path
        key={item.label}
        d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={color}
      />
    );
  });

  return (
    <div className="rt-piechart-wrap">
      {title && <div className="rt-obj-name">{title}</div>}
      <div className="rt-piechart-body">
        <svg viewBox="0 0 100 100" className="rt-piechart-svg">
          {slices}
        </svg>
        <div className="rt-piechart-legend">
          {items.map((item, i) => (
            <div key={item.label} className="rt-piechart-legend-row">
              <span className="rt-pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span>{item.label}</span>
              <span className="rt-pie-legend-pct">{((item.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  unit,
  subtitle,
  deltaPct,
  valueColor,
  onImageBg = false,
}: {
  title?: string;
  value: string;
  unit?: string;
  subtitle?: string;
  deltaPct?: number | null;
  valueColor?: string;
  onImageBg?: boolean;
}) {
  const delta = deltaPct != null && Number.isFinite(deltaPct) ? deltaPct : null;
  const textStyle = valueColor ? { color: valueColor } : undefined;
  return (
    <div className={`rt-kpicard${onImageBg ? ' rt-kpicard-on-image' : ''}`}>
      {title && <div className="rt-kpicard-title" style={textStyle}>{title}</div>}
      <div className="rt-kpicard-value-row">
        <span className="rt-kpicard-value" style={textStyle}>{value}</span>
        {unit && <span className="rt-kpicard-unit" style={textStyle}>{unit}</span>}
      </div>
      {subtitle && <div className="rt-kpicard-sub" style={textStyle}>{subtitle}</div>}
      {delta != null && (
        <div className={`rt-kpicard-delta${delta >= 0 ? ' up' : ' down'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
