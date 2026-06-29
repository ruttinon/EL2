import React from 'react';
import { AlertTriangle, DollarSign, Radio, Zap } from 'lucide-react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

function ringGeometry(size: number, stroke = 5) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  return { r, cx, cy, circumference, stroke };
}

export function KpiMiniRing({
  pct,
  color = 'var(--teal-600)',
  size = 54,
  label,
  spin = false,
  pulse = false,
}: {
  pct: number;
  color?: string;
  size?: number;
  label?: string;
  spin?: boolean;
  pulse?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const animated = useAnimatedNumber(clamped, 900);
  const { r, cx, cy, circumference, stroke } = ringGeometry(size);
  const offset = circumference - (animated / 100) * circumference;

  return (
    <div
      className={`kpi-mini-ring${spin ? ' kpi-mini-ring--spin' : ''}${pulse ? ' kpi-mini-ring--pulse' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="kpi-mini-ring-svg">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
          opacity="0.55"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="kpi-mini-ring-progress"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {spin && (
          <circle
            cx={cx}
            cy={cy}
            r={r + 5}
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeDasharray="3 7"
            opacity="0.35"
            className="kpi-mini-ring-orbit"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
      </svg>
      {label && <span className="kpi-mini-ring-label">{label}</span>}
    </div>
  );
}

export function KpiPowerAccent({
  totalPowerKw,
  peakDemandKw,
  history,
}: {
  totalPowerKw: number;
  peakDemandKw: number;
  history: Array<{ value: number }>;
}) {
  const loadPct = peakDemandKw > 0 ? (totalPowerKw / peakDemandKw) * 100 : 0;
  const points = history.slice(-16).map(h => h.value);
  const W = 132;
  const H = 40;

  let sparkPath = '';
  let areaPath = '';
  if (points.length >= 2) {
    const max = Math.max(...points, 0.1);
    const coords = points.map((v, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - 4 - (v / max) * (H - 8);
      return { x, y };
    });
    sparkPath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    areaPath = `${sparkPath} L ${W} ${H} L 0 ${H} Z`;
  }

  return (
    <div className="kpi-accent kpi-accent-power">
      <div className="kpi-accent-power-chart">
        {sparkPath ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="kpi-sparkline-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="kpiSparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--teal-600)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--teal-600)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} className="kpi-sparkline-area" />
            <path d={sparkPath} className="kpi-sparkline-line" />
          </svg>
        ) : (
          <div className="kpi-accent-placeholder">
            <Zap size={14} />
            <span>Awaiting load data</span>
          </div>
        )}
      </div>
      <KpiMiniRing pct={loadPct} color="var(--teal-600)" label={`${loadPct.toFixed(0)}% peak`} spin />
    </div>
  );
}

export function KpiAlarmAccent({ activeAlarms, unacknowledged }: { activeAlarms: number; unacknowledged: number }) {
  const isAlert = activeAlarms > 0;
  const fillPct = isAlert ? Math.min(100, activeAlarms * 25 + 20) : 100;
  const color = isAlert ? 'var(--red)' : 'var(--green)';

  return (
    <div className={`kpi-accent kpi-accent-alarm${isAlert ? ' kpi-accent-alarm--active' : ''}`}>
      <div className="kpi-accent-alarm-copy">
        <AlertTriangle size={16} />
        <div>
          <b>{isAlert ? 'Attention required' : 'All clear'}</b>
          <span>{unacknowledged} waiting for acknowledge</span>
        </div>
      </div>
      <KpiMiniRing pct={fillPct} color={color} label={isAlert ? 'active' : 'safe'} pulse={isAlert} />
    </div>
  );
}

export function KpiDeviceAccent({ online, total }: { online: number; total: number }) {
  const pct = total > 0 ? (online / total) * 100 : 0;
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="kpi-accent kpi-accent-device">
      <div className="kpi-accent-device-bars">
        {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
          <span
            key={i}
            className={`kpi-device-bar${i < online ? ' on' : ''}`}
            style={{ animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>
      <KpiMiniRing pct={pct} color={color} label={`${online}/${total}`} spin />
    </div>
  );
}

export function KpiCommAccent({ commPct, isLive }: { commPct: number; isLive: boolean }) {
  const color = commPct > 80 ? 'var(--green)' : commPct > 50 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="kpi-accent kpi-accent-comm">
      <div className="kpi-accent-comm-waves">
        <Radio size={14} className={isLive ? 'kpi-comm-icon-live' : ''} />
        <div className="kpi-comm-wave-track">
          {[0.35, 0.55, 0.75, 0.95].map((h, i) => (
            <span
              key={i}
              className="kpi-comm-wave-bar"
              style={{
                height: `${h * 100}%`,
                animationDelay: `${i * 0.12}s`,
                opacity: commPct > i * 25 ? 1 : 0.25,
              }}
            />
          ))}
        </div>
      </div>
      <KpiMiniRing pct={commPct} color={color} label="signal" spin={isLive} />
    </div>
  );
}

export function KpiCostAccent({ energyCost, energyKwh }: { energyCost: number; energyKwh: number }) {
  const animated = useAnimatedNumber(energyCost, 900);
  const intensity = Math.min(100, Math.max(12, (energyKwh / 900) * 100));

  return (
    <div className="kpi-accent kpi-accent-cost">
      <div className="kpi-accent-cost-body">
        <DollarSign size={14} />
        <div className="kpi-cost-track">
          <div className="kpi-cost-fill" style={{ width: `${intensity}%` }} />
          <div className="kpi-cost-shimmer" style={{ width: `${intensity}%` }} />
        </div>
        <span className="kpi-cost-caption">~${animated.toFixed(2)} session</span>
      </div>
      <KpiMiniRing pct={intensity} color="var(--amber)" label="spend" />
    </div>
  );
}

export function KpiPeakAccent({
  totalPowerKw,
  peakDemandKw,
}: {
  totalPowerKw: number;
  peakDemandKw: number;
}) {
  const currentPct = peakDemandKw > 0 ? (totalPowerKw / peakDemandKw) * 100 : 0;
  const headroom = Math.max(0, 100 - currentPct);

  return (
    <div className="kpi-accent kpi-accent-peak">
      <div className="kpi-peak-bars">
        <div className="kpi-peak-row">
          <span>Now</span>
          <div className="kpi-peak-track">
            <div className="kpi-peak-fill now" style={{ width: `${currentPct}%` }} />
          </div>
          <b>{totalPowerKw.toFixed(1)}</b>
        </div>
        <div className="kpi-peak-row">
          <span>Peak</span>
          <div className="kpi-peak-track">
            <div className="kpi-peak-fill peak" style={{ width: '100%' }} />
          </div>
          <b>{peakDemandKw.toFixed(1)}</b>
        </div>
        <div className="kpi-peak-headroom">{headroom.toFixed(0)}% headroom left</div>
      </div>
      <KpiMiniRing pct={currentPct} color="var(--teal-600)" label="load" spin />
    </div>
  );
}
