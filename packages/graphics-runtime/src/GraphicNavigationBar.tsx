import React from 'react';

export type GraphicNavigationBarProps = {
  canGoBack: boolean;
  onBack: () => void;
  currentLabel?: string;
  stackLabels?: string[];
  floors?: number[];
  activeFloor?: number | null;
  onFloorChange?: (floor: number | null) => void;
  className?: string;
};

/** Back button + optional floor selector for drill-down scenes */
export function GraphicNavigationBar({
  canGoBack,
  onBack,
  currentLabel,
  stackLabels,
  floors = [],
  activeFloor = null,
  onFloorChange,
  className = 'graphic-nav-bar',
}: GraphicNavigationBarProps) {
  const showBar = canGoBack || floors.length > 0;
  if (!showBar) return null;

  return (
    <div className={className}>
      {canGoBack ? (
        <button type="button" className="graphic-nav-back btn secondary tiny" onClick={onBack}>
          ← Back
        </button>
      ) : null}
      {stackLabels && stackLabels.length > 1 ? (
        <span className="graphic-nav-breadcrumb">
          {stackLabels.join(' › ')}
        </span>
      ) : currentLabel ? (
        <span className="graphic-nav-current">{currentLabel}</span>
      ) : null}
      {floors.length > 0 && onFloorChange ? (
        <div className="graphic-nav-floors">
          <button
            type="button"
            className={`graphic-nav-floor${activeFloor == null ? ' active' : ''}`}
            onClick={() => onFloorChange(null)}
          >
            All
          </button>
          {floors.map((f) => (
            <button
              key={f}
              type="button"
              className={`graphic-nav-floor${activeFloor === f ? ' active' : ''}`}
              onClick={() => onFloorChange(f)}
            >
              F{f}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
