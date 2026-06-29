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

type CarbonLoadBreakdownProps = {
  breakdown?: CarbonBreakdownResponse;
  loading?: boolean;
};

export function CarbonLoadBreakdown({ breakdown, loading }: CarbonLoadBreakdownProps) {
  const items = breakdown?.items ?? [];
  const totalKwh = breakdown?.totalKwh ?? 0;
  const totalCarbon = breakdown?.totalCarbonKg ?? 0;
  const animatedTotal = useAnimatedNumber(totalKwh, 400, 0.1);
  const maxKwh = Math.max(...items.map(i => i.kWh), 0.001);

  return (
    <section className="carbon-load-breakdown card">
      <div className="carbon-load-breakdown-head">
        <h2 className="carbon-load-breakdown-title">
          By load type
          <span className="carbon-load-breakdown-total">
            {animatedTotal.toFixed(1)} kWh · {totalCarbon.toFixed(1)} kg
          </span>
        </h2>
      </div>

      <div className="carbon-load-breakdown-body">
        {loading && !breakdown ? (
          <p className="carbon-breakdown-empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="carbon-breakdown-empty">No load category data from meters</p>
        ) : (
          <ul className="carbon-load-list">
            {items.map((item, idx) => {
              const widthPct = totalKwh > 0 ? (item.kWh / maxKwh) * 100 : 0;
              const color = COLORS[idx % COLORS.length];
              return (
                <li key={item.key} className="carbon-load-row">
                  <div className="carbon-load-row-top">
                    <span className="carbon-load-dot" style={{ background: color }} />
                    <span className="carbon-load-label">{item.label}</span>
                    <span className="carbon-load-share">{item.sharePct.toFixed(0)}%</span>
                  </div>
                  <div className="carbon-load-bar-track">
                    <div
                      className="carbon-load-bar-fill"
                      style={{ width: `${widthPct}%`, background: color }}
                    />
                  </div>
                  <div className="carbon-load-row-values">
                    <span>{item.kWh.toFixed(1)} kWh</span>
                    <span>{item.carbonKg.toFixed(1)} kg</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
