import React from 'react';
import { Cloud, Leaf, TreeDeciduous } from 'lucide-react';
import type { SustainabilityMetrics } from '../utils/sustainability';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { CarbonLeafFallScene, resolveCarbonHealth } from './CarbonLeafFallScene';

export function CarbonImpactCard({
  metrics,
  energyKwh,
  compact = false,
}: {
  metrics: SustainabilityMetrics;
  energyKwh: number;
  compact?: boolean;
}) {
  const health = resolveCarbonHealth(metrics);
  const offsetKg = Math.max(0, metrics.carbonSavedKg);
  const netKg = Math.max(0, metrics.carbonEmittedKg - metrics.carbonSavedKg);
  const netPositive = metrics.carbonSavedKg >= metrics.carbonEmittedKg * 0.2;
  const animatedOffset = useAnimatedNumber(offsetKg, 900);
  const goalPct = Math.min(100, (offsetKg / Math.max(metrics.baselineKwh * metrics.emissionFactorKgPerKwh, 1)) * 100);

  if (compact) {
    return (
      <section className="carbon-impact carbon-impact--compact">
        <div className="carbon-impact-head">
          <div>
            <h2 className="carbon-impact-title">Carbon</h2>
            <p className="carbon-impact-sub">{energyKwh.toFixed(1)} kWh session</p>
          </div>
          <span className="carbon-impact-compact-offset">{animatedOffset.toFixed(1)} kg offset</span>
        </div>
        <div className="carbon-impact-compact-scene">
          <CarbonLeafFallScene health={health} className="carbon-leaf-scene--compact" showCaption={false} />
        </div>
        <div className="carbon-impact-inline">
          <span><Cloud size={14} /> {metrics.carbonEmittedKg.toFixed(1)} emitted</span>
          <span><Leaf size={14} /> {offsetKg.toFixed(1)} offset</span>
          <span><TreeDeciduous size={14} /> {netKg.toFixed(1)} net</span>
        </div>
        <div className="carbon-impact-track">
          <div className="carbon-impact-fill" style={{ width: `${goalPct}%` }} />
        </div>
      </section>
    );
  }

  return (
    <section className="carbon-impact card dash-animate">
      <div className="carbon-impact-head">
        <div>
          <h2 className="carbon-impact-title">Carbon Impact</h2>
          <p className="carbon-impact-sub">Estimated from real meter readings · {energyKwh.toFixed(1)} kWh</p>
        </div>
        <span className={`runtime-chip${netPositive ? ' runtime-chip-teal' : ''}`}>
          {netPositive ? 'Net Positive' : 'Monitor Load'}
        </span>
      </div>

      <div className="carbon-impact-hero">
        <CarbonLeafFallScene health={health} className="carbon-leaf-scene--dashboard" showCaption={false} />
        <div className="carbon-impact-hero-copy">
          <b>Lower emissions. Greener operations.</b>
          <span>Leaf color reflects current load vs session peak.</span>
          <span className="carbon-impact-badge">{animatedOffset.toFixed(1)} kg CO₂e offset</span>
        </div>
      </div>

      <div className="carbon-impact-metrics">
        <div className="carbon-impact-metric">
          <Cloud size={18} />
          <span>Emitted</span>
          <b>{metrics.carbonEmittedKg.toFixed(1)}</b>
          <small>kg CO₂e</small>
        </div>
        <div className="carbon-impact-metric highlight">
          <Leaf size={18} />
          <span>Offset</span>
          <b>{offsetKg.toFixed(1)}</b>
          <small>kg CO₂e</small>
        </div>
        <div className="carbon-impact-metric">
          <TreeDeciduous size={18} />
          <span>Net</span>
          <b>{netKg.toFixed(1)}</b>
          <small>kg CO₂e</small>
        </div>
      </div>

      <div className="carbon-impact-progress">
        <div className="carbon-impact-progress-head">
          <span>Offset progress</span>
          <b>{goalPct.toFixed(0)}%</b>
        </div>
        <div className="carbon-impact-track">
          <div className="carbon-impact-fill" style={{ width: `${goalPct}%` }} />
        </div>
      </div>
    </section>
  );
}
