import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { validateFormulaSyntax } from '@energylink/graphics-runtime';
import { inferDeviceNumericTag, inferDeviceStatusTag, tagsForDevice } from '@energylink/widget-registry';
import { hexForColorInput } from '../../../colorInput';
import { mergeStyle, styleNum, styleStr } from '../inspectorUtils';
import { SCADA_BADGE_MAP, SCADA_STATE_SLOTS_JSON, SCADA_STATES_LABELS } from '../../scadaPresets';
import {
  BAR_VALUE_TYPES,
  NUMERIC_VALUE_TYPES,
  RANGE_VALUE_TYPES,
  STATE_SLOT_TYPES,
  VALUE_WIDGET_TITLES,
} from '../valueWidgetMeta';
import { ChromeAppearance } from '../shared/ChromeAppearance';
import { DeviceTagBinding } from '../../../widget-registry/inspectors/DeviceTagBinding';

export type ValueWidgetInspectorProps = {
  selected: GraphicObjectDefinition;
  tagOptions: TagSummary[];
  tags: TagSummary[];
  devices?: DeviceSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
};

export function ValueWidgetInspector({
  selected,
  tagOptions,
  tags,
  devices = [],
  onUpdate,
}: ValueWidgetInspectorProps) {
  const type = selected.type;
  const title = VALUE_WIDGET_TITLES[type] ?? type;

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    const barType = BAR_VALUE_TYPES.has(type);
    onUpdate(selected.id, { style: mergeStyle(selected, patch, { barType }) });
  };

  const showTitle = type !== 'led' && type !== 'status' && type !== 'progressbar' && type !== 'levelbar';
  const showTextLabel = type === 'multistate' || type === 'statusbadge';
  const inferTag = NUMERIC_VALUE_TYPES.has(type) || BAR_VALUE_TYPES.has(type) || RANGE_VALUE_TYPES.has(type)
    ? inferDeviceNumericTag
    : STATE_SLOT_TYPES.has(type)
      ? inferDeviceStatusTag
      : undefined;
  const scopedTagOptions = selected.deviceId ? tagsForDevice(tagOptions, selected.deviceId) : tagOptions;

  return (
    <section className="ins-sec ins-sec-premium ins-value-simple">
      <h4>{title}</h4>

      {type !== 'formulavalue' && devices.length > 0 && inferTag ? (
        <DeviceTagBinding
          selected={selected}
          devices={devices}
          tags={tags}
          onUpdate={onUpdate}
          inferTag={inferTag}
          tagLabel={STATE_SLOT_TYPES.has(type) ? 'Status Tag' : 'Tag'}
        />
      ) : null}

      {showTitle ? (
        <label className="ins-row">
          <span>{type === 'gauge' ? 'Title' : type === 'kpicard' ? 'KPI Name' : 'Title'}</span>
          <input
            value={selected.text ?? ''}
            onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
            placeholder={type === 'gauge' ? 'Gauge' : type === 'value' ? 'Power' : ''}
          />
        </label>
      ) : null}

      {showTextLabel ? (
        <label className="ins-row">
          <span>Default Text</span>
          <input
            value={selected.text ?? ''}
            onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
            placeholder="Running / Online…"
          />
        </label>
      ) : null}

      {type === 'formulavalue' ? (
        <>
          <label className="ins-row ins-row-stack">
            <span>Formula</span>
            <input
              value={styleStr(selected, 'formula', 'A + B')}
              onChange={(e) => setStyle({ formula: e.target.value })}
              placeholder="A + B, {tagId} * 1.5"
            />
          </label>
          <label className="ins-row ins-row-stack">
            <span>Variables (A,B,C…)</span>
            <input
              value={(selected.tagIds ?? (selected.tagId ? [selected.tagId] : [])).join(', ')}
              onChange={(e) => {
                const ids = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                onUpdate(selected.id, { tagIds: ids, tagId: ids[0] || undefined });
              }}
              placeholder="Select tag below or type id"
            />
          </label>
          {(() => {
            const ids = selected.tagIds ?? (selected.tagId ? [selected.tagId] : []);
            const v = validateFormulaSyntax(styleStr(selected, 'formula', 'A'), ids);
            return 'error' in v ? <p className="ins-hint ins-hint-warn">{v.error}</p> : null;
          })()}
          <label className="ins-row">
            <span>Add tag</span>
            <select
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                const ids = [...(selected.tagIds ?? (selected.tagId ? [selected.tagId] : []))];
                if (!ids.includes(id)) ids.push(id);
                onUpdate(selected.id, { tagIds: ids, tagId: ids[0] || undefined });
              }}
            >
              <option value="">— Select from list —</option>
              {tagOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
              ))}
            </select>
          </label>
        </>
      ) : type !== 'formulavalue' && !(devices.length > 0 && inferTag) ? (
        <label className="ins-row">
          <span>Tag</span>
          <select
            value={selected.tagId ?? ''}
            onChange={(e) => onUpdate(selected.id, {
              tagId: e.target.value || undefined,
              binding: { ...selected.binding, tagId: e.target.value || undefined },
            })}
          >
            <option value="">— Select tag —</option>
            {scopedTagOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
            ))}
          </select>
        </label>
      ) : null}

      {NUMERIC_VALUE_TYPES.has(type) ? (
        <div className="ins-grid2">
          <label className="ins-row">
            <span>Unit</span>
            <input
              value={styleStr(selected, 'unit', '')}
              onChange={(e) => setStyle({ unit: e.target.value })}
              placeholder={type === 'gauge' ? '%' : 'kW, °C…'}
            />
          </label>
          <label className="ins-row">
            <span>Decimals</span>
            <input
              type="number"
              min={0}
              max={6}
              value={styleNum(selected, 'decimalPlaces', type === 'kpicard' ? 0 : 2)}
              onChange={(e) => setStyle({ decimalPlaces: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : null}

      {RANGE_VALUE_TYPES.has(type) ? (
        <div className="ins-grid2">
          <label className="ins-row">
            <span>Min Value</span>
            <input
              type="number"
              value={styleNum(selected, 'min', 0)}
              onChange={(e) => setStyle({ min: Number(e.target.value) })}
            />
          </label>
          <label className="ins-row">
            <span>Max Value</span>
            <input
              type="number"
              value={styleNum(selected, 'max', 100)}
              onChange={(e) => setStyle({ max: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : null}

      {type === 'led' ? (
        <>
          <div className="ins-grid2">
            <label className="ins-row">
              <span>ON Color</span>
              <input
                type="color"
                value={hexForColorInput(
                  styleStr(selected, 'stateOnColor', styleStr(selected, 'onColor', '#22c55e')),
                  '#22c55e',
                )}
                onChange={(e) => setStyle({ stateOnColor: e.target.value, onColor: e.target.value })}
              />
            </label>
            <label className="ins-row">
              <span>OFF Color</span>
              <input
                type="color"
                value={hexForColorInput(
                  styleStr(selected, 'stateOffColor', styleStr(selected, 'offColor', '#94a3b8')),
                  '#94a3b8',
                )}
                onChange={(e) => setStyle({ stateOffColor: e.target.value, offColor: e.target.value })}
              />
            </label>
          </div>
          <label className="ins-check">
            <input
              type="checkbox"
              checked={selected.style?.stateOnGlow !== false}
              onChange={(e) => setStyle({ stateOnGlow: e.target.checked })}
            />
            <span>Glow when ON</span>
          </label>
        </>
      ) : null}

      {BAR_VALUE_TYPES.has(type) ? (
        <div className="ins-grid2">
          <label className="ins-row">
            <span>Bar Color</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'fill', '#22c55e'), '#22c55e')}
              onChange={(e) => setStyle({ fill: e.target.value })}
            />
          </label>
          <label className="ins-row">
            <span>Track Color</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'trackColor', '#e2e8f0'), '#e2e8f0')}
              onChange={(e) => setStyle({ trackColor: e.target.value })}
            />
          </label>
        </div>
      ) : null}

      {BAR_VALUE_TYPES.has(type) ? (
        <>
          <label className="ins-row">
            <span>Orientation</span>
            <select
              value={styleStr(selected, 'barOrientation', type === 'levelbar' ? 'vertical' : 'horizontal')}
              onChange={(e) => setStyle({ barOrientation: e.target.value })}
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>
          {type === 'levelbar' ? (
            <p className="ins-hint">Level Bar is deprecated, use Progress Bar (vertical) instead.</p>
          ) : null}
        </>
      ) : null}

      {type === 'gauge' ? (
        <div className="ins-grid2">
          <label className="ins-row">
            <span>Needle Color</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'color', '#056473'), '#056473')}
              onChange={(e) => setStyle({ color: e.target.value })}
            />
          </label>
          <label className="ins-row">
            <span>Gauge Track Color</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'stroke', '#9fc4cc'), '#9fc4cc')}
              onChange={(e) => setStyle({ stroke: e.target.value, borderColor: e.target.value })}
            />
          </label>
        </div>
      ) : null}

      {type === 'kpicard' ? (
        <label className="ins-row">
          <span>Delta tag</span>
          <select
            value={styleStr(selected, 'deltaTagId', '')}
            onChange={(e) => setStyle({ deltaTagId: e.target.value || undefined })}
          >
            <option value="">— No delta —</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
            ))}
          </select>
        </label>
      ) : null}

      {type === 'semaphore' ? (
        <p className="ins-hint">Tag value: 0=Green, 1=Yellow, 2+=Red — Adjust colors in &quot;Advanced Settings&quot;</p>
      ) : null}

      {type === 'multistate' || type === 'statusbadge' ? (
        <>
          <p className="ins-hint">Configure state text/colors in &quot;Advanced Settings&quot; → State List</p>
          <button
            type="button"
            className="ins-preset-btn"
            onClick={() => setStyle(
              type === 'multistate'
                ? { states: SCADA_STATES_LABELS, stateSlotsJson: SCADA_STATE_SLOTS_JSON }
                : { badgeMap: SCADA_BADGE_MAP, stateSlotsJson: SCADA_STATE_SLOTS_JSON },
            )}
          >
            Apply SCADA Preset (Stopped / Running / Fault / Comm Fail)
          </button>
        </>
      ) : null}

      {!BAR_VALUE_TYPES.has(type) && type !== 'led' ? (
        <ChromeAppearance
          selected={selected}
          setStyle={setStyle}
          textColor={type !== 'gauge'}
          fontSize={type === 'value' || type === 'kpicard'}
          fillLabel={type === 'gauge' ? 'Gauge Background' : type === 'kpicard' ? 'Card Background' : 'Background Color'}
          defaultFill={type === 'kpicard' ? '#f0f9ff' : '#ffffff'}
          defaultTextColor={type === 'value' ? '#e2e8f0' : '#142033'}
        />
      ) : null}
    </section>
  );
}
