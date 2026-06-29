import React from 'react';
import { Leaf, Sparkles, TreeDeciduous, Zap } from 'lucide-react';
import type { SustainabilityMetrics } from '../utils/sustainability';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { CarbonLeafFallScene, resolveCarbonHealth } from './CarbonLeafFallScene';

/** Ambient leaf + rising CO₂ bubbles for the carbon KPI card. */
export function CarbonKpiAccent({ tons }: { tons: number }) {
  const intensity = Math.min(1, tons / 2);
  return (
    <div className="sustain-visual carbon-visual" aria-hidden="true">
      <div className="carbon-orbit" style={{ opacity: 0.35 + intensity * 0.45 }}>
        <span className="carbon-bubble carbon-bubble-1" />
        <span className="carbon-bubble carbon-bubble-2" />
        <span className="carbon-bubble carbon-bubble-3" />
      </div>
      <Leaf className="carbon-leaf-float" size={26} strokeWidth={2.2} />
      <span className="carbon-visual-ring" />
    </div>
  );
}

/** Peak-vs-current savings strip for the energy KPI card. */
export function EnergySavingAccent({ savingsPct, savedKwh }: { savingsPct: number; savedKwh: number }) {
  const pct = Math.max(0, Math.min(100, savingsPct));
  return (
    <div className="sustain-visual energy-save-visual" aria-hidden="true">
      <div className="energy-save-head">
        <Zap size={12} />
        <span>vs session peak</span>
      </div>
      <div className="energy-save-track">
        <div className="energy-save-fill energy-save-fill-animate" style={{ width: `${pct}%` }} />
        <div className="energy-save-shimmer" />
      </div>
      <div className="energy-save-meta">
        <b>{pct.toFixed(0)}%</b>
        <span>lower · ~{savedKwh.toFixed(1)} kWh saved</span>
      </div>
    </div>
  );
}

export function EnergySavingsWidget({
  metrics,
  currentPowerKw,
  peakDemandKw,
}: {
  metrics: SustainabilityMetrics;
  currentPowerKw: number;
  peakDemandKw: number;
}) {
  const animatedSaved = useAnimatedNumber(metrics.savedKwh, 900);
  const animatedPct = useAnimatedNumber(metrics.peakSavingsPct, 900);
  const maxKwh = Math.max(metrics.baselineKwh, metrics.baselineKwh - metrics.savedKwh, 0.1);
  const actualPct = (metrics.baselineKwh - metrics.savedKwh) / maxKwh * 100;
  const baselinePct = 100;

  return (
    <div className="sustain-widget card dash-animate dash-animate-delay-3">
      <div className="sustain-widget-head">
        <div>
          <h3 className="sustain-widget-title">
            <Zap size={16} />
            Energy Savings vs Baseline
          </h3>
          <p className="sustain-widget-sub">Baseline from session peak load profile</p>
        </div>
        <span className="runtime-chip runtime-chip-teal">{animatedPct.toFixed(0)}% saved</span>
      </div>

      <div className="sustain-compare-bars">
        <div className="sustain-compare-row">
          <span className="sustain-compare-label">Baseline</span>
          <div className="sustain-compare-track">
            <div
              className="sustain-compare-fill baseline sustain-bar-grow"
              style={{ width: `${baselinePct}%` }}
            />
          </div>
          <b className="sustain-compare-value">{metrics.baselineKwh.toFixed(1)} kWh</b>
        </div>
        <div className="sustain-compare-row">
          <span className="sustain-compare-label">Actual</span>
          <div className="sustain-compare-track">
            <div
              className="sustain-compare-fill actual sustain-bar-grow"
              style={{ width: `${Math.max(actualPct, 4)}%`, animationDelay: '0.15s' }}
            />
            <div className="sustain-compare-shimmer" style={{ width: `${Math.max(actualPct, 4)}%` }} />
          </div>
          <b className="sustain-compare-value teal">{(metrics.baselineKwh - metrics.savedKwh).toFixed(1)} kWh</b>
        </div>
      </div>

      <div className="sustain-widget-stats">
        <div className="sustain-stat-pill">
          <span>Saved</span>
          <b>{animatedSaved.toFixed(1)} kWh</b>
        </div>
        <div className="sustain-stat-pill">
          <span>Peak now</span>
          <b>{currentPowerKw.toFixed(1)} / {peakDemandKw.toFixed(1)} kW</b>
        </div>
        <div className="sustain-stat-pill">
          <span>Cost saved</span>
          <b>${metrics.energyCostSaved.toFixed(2)}</b>
        </div>
      </div>
    </div>
  );
}

export function CarbonOffsetWidget({ metrics }: { metrics: SustainabilityMetrics }) {
  const carbonHealth = resolveCarbonHealth(metrics);
  const animatedSavedTons = useAnimatedNumber(metrics.carbonSavedTons, 1000);
  const animatedEmittedTons = useAnimatedNumber(metrics.carbonEmittedTons, 1000);

  return (
    <div className="sustain-widget card dash-animate dash-animate-delay-4">
      <div className="sustain-widget-head">
        <div>
          <h3 className="sustain-widget-title">
            <TreeDeciduous size={16} />
            Carbon Offset
          </h3>
          <p className="sustain-widget-sub">
            Factor {metrics.emissionFactorKgPerKwh} kg CO₂/kWh
          </p>
        </div>
        {metrics.carbonSavedKg > 0 && (
          <span className="sustain-offset-badge">
            <Sparkles size={12} />
            Offset active
          </span>
        )}
      </div>

      <CarbonLeafFallScene health={carbonHealth} className="carbon-leaf-scene--compact" showCaption={false} />

      <div className="carbon-offset-metrics">
        <div className="carbon-offset-metric">
          <span>Emitted</span>
          <b>{animatedEmittedTons.toFixed(3)} t</b>
        </div>
        <div className="carbon-offset-metric saved">
          <span>Saved</span>
          <b>{animatedSavedTons.toFixed(3)} t</b>
        </div>
        <div className="carbon-offset-metric">
          <span>Tree equiv.</span>
          <b>{metrics.treesEquivalent.toFixed(2)}</b>
        </div>
      </div>
      <p className="carbon-offset-note">
        Estimated CO₂ avoided vs baseline consumption this session.
      </p>
    </div>
  );
}
