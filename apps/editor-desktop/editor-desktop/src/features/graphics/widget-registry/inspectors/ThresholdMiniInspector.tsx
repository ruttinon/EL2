import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { hexForColorInput } from '../../colorInput';
import { mergeStyle, styleNum, styleStr } from '../../editor/inspector/inspectorUtils';

const THRESHOLD_TYPES = new Set(['value', 'gauge', 'progressbar', 'levelbar', 'kpicard']);

export function ThresholdMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  if (!THRESHOLD_TYPES.has(selected.type)) return null;

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <details className="ins-composer-group" open={false}>
      <summary>Thresholds</summary>
      <div className="ins-composer-fields">
        <p className="ins-hint">Change color based on value ranges</p>
        <div className="ins-grid2">
          <label className="ins-row">
            <span>High Limit (≥)</span>
            <input
              type="number"
              value={styleNum(selected, 'thresholdHigh', 80)}
              onChange={(e) => setStyle({ thresholdHigh: Number(e.target.value) })}
            />
          </label>
          <label className="ins-row">
            <span>Low Limit (≤)</span>
            <input
              type="number"
              value={styleNum(selected, 'thresholdLow', 20)}
              onChange={(e) => setStyle({ thresholdLow: Number(e.target.value) })}
            />
          </label>
          <label className="ins-row">
            <span>High Color</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'alarmColor', '#fee2e2'), '#fee2e2')}
              onChange={(e) => setStyle({ alarmColor: e.target.value })}
            />
          </label>
          <label className="ins-row">
            <span>Low Color</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'warningColor', '#fef3c7'), '#fef3c7')}
              onChange={(e) => setStyle({ warningColor: e.target.value })}
            />
          </label>
        </div>
      </div>
    </details>
  );
}

export function widgetHasThresholds(defGroups: Array<string | { custom: string }>): boolean {
  return defGroups.some((g) => g === 'thresholds');
}
