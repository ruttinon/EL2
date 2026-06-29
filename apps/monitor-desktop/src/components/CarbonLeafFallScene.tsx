import React from 'react';
import { Leaf } from 'lucide-react';
import type { SustainabilityMetrics } from '../utils/sustainability';

export type CarbonHealth = 'low' | 'moderate' | 'high';

export function resolveCarbonHealth(metrics: SustainabilityMetrics): CarbonHealth {
  if (metrics.peakSavingsPct >= 35 || metrics.carbonSavedKg > metrics.carbonEmittedKg * 1.2) {
    return 'low';
  }
  if (metrics.peakSavingsPct >= 10) return 'moderate';
  return 'high';
}

const HEALTH_COPY: Record<CarbonHealth, { title: string; hint: string }> = {
  low: { title: 'Low load', hint: 'Below session peak' },
  moderate: { title: 'Moderate', hint: 'Near session peak' },
  high: { title: 'High load', hint: 'At session peak' },
};

const LEAF_COUNT = 12;

export function CarbonLeafFallScene({
  health,
  className,
  showCaption = true,
}: {
  health: CarbonHealth;
  className?: string;
  showCaption?: boolean;
}) {
  const leaves = React.useMemo(
    () =>
      Array.from({ length: LEAF_COUNT }, (_, i) => ({
        id: i,
        left: `${6 + ((i * 17) % 88)}%`,
        delay: `${(i * 0.55) % 4.5}s`,
        duration: `${2.8 + (i % 4) * 0.35}s`,
        drift: i % 2 === 0 ? -1 : 1,
        size: 14 + (i % 3) * 4,
      })),
    [],
  );
  const copy = HEALTH_COPY[health];

  return (
    <div className={`carbon-leaf-scene carbon-leaf-scene--${health}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <div className="carbon-leaf-scene-sky" />
      <span className="carbon-leaf-cloud carbon-leaf-cloud-1" />
      <span className="carbon-leaf-cloud carbon-leaf-cloud-2" />
      <span className="carbon-leaf-hill carbon-leaf-hill-1" />
      <span className="carbon-leaf-hill carbon-leaf-hill-2" />
      <div className="carbon-leaf-scene-canopy">
        <Leaf className="carbon-leaf-scene-tree" size={36} strokeWidth={1.8} />
      </div>
      {leaves.map(leaf => (
        <span
          key={leaf.id}
          className={`carbon-falling-leaf carbon-falling-leaf--${leaf.id % 3}`}
          style={{
            left: leaf.left,
            animationDelay: leaf.delay,
            animationDuration: leaf.duration,
            ['--leaf-drift' as string]: `${leaf.drift * 18}px`,
          }}
        >
          <Leaf size={leaf.size} strokeWidth={2.2} />
        </span>
      ))}
      <div className="carbon-leaf-scene-ground" />
      {showCaption && (
        <div className="carbon-leaf-scene-caption">
          <b>{copy.title}</b>
          <span>{copy.hint}</span>
        </div>
      )}
    </div>
  );
}
