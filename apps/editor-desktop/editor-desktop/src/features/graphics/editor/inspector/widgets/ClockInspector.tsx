import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { hexForColorInput } from '../../../colorInput';
import { mergeStyle, styleNum, styleStr } from '../inspectorUtils';

export type ClockInspectorProps = {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
};

export function ClockInspector({ selected, onUpdate }: ClockInspectorProps) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const variant = styleStr(selected, 'clockVariant', 'digital');

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>Clock</h4>

      <label className="ins-row">
        <span>Label Under Clock</span>
        <input
          value={selected.text ?? ''}
          onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
          placeholder="(Optional)"
        />
      </label>

      <label className="ins-row">
        <span>Type</span>
        <select
          value={variant}
          onChange={(e) => {
            const v = e.target.value;
            const patch: Record<string, string | number | boolean> = { clockVariant: v };
            if (v === 'analog' && selected.height < 80) {
              onUpdate(selected.id, {
                width: Math.max(selected.width, 100),
                height: Math.max(selected.height, 100),
                style: { ...selected.style, ...patch },
              });
              return;
            }
            if (v === 'compact') patch.showDate = false;
            setStyle(patch);
          }}
        >
          <option value="digital">Digital (Time + Date)</option>
          <option value="compact">Compact</option>
          <option value="analog">Analog</option>
          <option value="wall">Wall Clock</option>
          <option value="date">Date Focused</option>
        </select>
      </label>

      <div className="ins-grid2">
        <label className="ins-row">
          <span>Time Format</span>
          <select value={styleStr(selected, 'clockTimeStyle', '24h')} onChange={(e) => setStyle({ clockTimeStyle: e.target.value })}>
            <option value="24h">24h</option>
            <option value="12h">12h</option>
          </select>
        </label>
        <label className="ins-row">
          <span>Timezone</span>
          <select value={styleStr(selected, 'clockFormat', 'local')} onChange={(e) => setStyle({ clockFormat: e.target.value })}>
            <option value="local">Local</option>
            <option value="utc">UTC</option>
            <option value="server">Server</option>
          </select>
        </label>
      </div>

      {variant !== 'compact' ? (
        <label className="ins-check">
          <input type="checkbox" checked={selected.style?.showDate !== false} onChange={(e) => setStyle({ showDate: e.target.checked })} />
          <span>Show Date</span>
        </label>
      ) : null}
      <label className="ins-check">
        <input type="checkbox" checked={selected.style?.showSeconds !== false} onChange={(e) => setStyle({ showSeconds: e.target.checked })} />
        <span>Show Seconds</span>
      </label>

      <div className="ins-grid2">
        <label className="ins-row"><span>Background Color</span>
          <input type="color" value={hexForColorInput(styleStr(selected, 'fill', styleStr(selected, 'background', '#ffffff')), '#ffffff')} onChange={(e) => setStyle({ fill: e.target.value, background: e.target.value })} />
        </label>
        <label className="ins-row"><span>Text/Number Color</span>
          <input type="color" value={hexForColorInput(styleStr(selected, 'color', '#142033'), '#142033')} onChange={(e) => setStyle({ color: e.target.value })} />
        </label>
        <label className="ins-row"><span>Border</span>
          <input type="color" value={hexForColorInput(styleStr(selected, 'stroke', '#9fc4cc'), '#9fc4cc')} onChange={(e) => setStyle({ stroke: e.target.value, borderColor: e.target.value })} />
        </label>
        <label className="ins-row"><span>Font Size</span>
          <input type="number" min={8} max={72} value={styleNum(selected, 'fontSize', 22)} onChange={(e) => setStyle({ fontSize: Number(e.target.value) })} />
        </label>
      </div>

      <label className="ins-row">
        <span>Alignment</span>
        <select value={styleStr(selected, 'textAlign', styleStr(selected, 'align', 'center'))} onChange={(e) => setStyle({ textAlign: e.target.value, align: e.target.value })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>

      {variant === 'analog' ? (
        <details className="ins-more ins-more-premium">
          <summary>Analog Clock Face</summary>
          <div className="ins-grid2">
            <label className="ins-row"><span>Face Color</span>
              <input type="color" value={hexForColorInput(styleStr(selected, 'clockFaceColor', '#f8fafc'), '#f8fafc')} onChange={(e) => setStyle({ clockFaceColor: e.target.value })} />
            </label>
            <label className="ins-row"><span>Hand Color</span>
              <input type="color" value={hexForColorInput(styleStr(selected, 'clockHandColor', styleStr(selected, 'color', '#142033')), '#142033')} onChange={(e) => setStyle({ clockHandColor: e.target.value })} />
            </label>
            <label className="ins-row"><span>Tick Color</span>
              <input type="color" value={hexForColorInput(styleStr(selected, 'clockTickColor', '#94a3b8'), '#94a3b8')} onChange={(e) => setStyle({ clockTickColor: e.target.value })} />
            </label>
          </div>
        </details>
      ) : null}
    </section>
  );
}
