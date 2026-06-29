import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { tagsForDevice, inferDeviceNumericTag } from '@energylink/widget-registry';
import { hexForColorInput } from '../../../colorInput';
import { mergeStyle, styleBool, styleNum, styleStr } from '../inspectorUtils';
import {
  CHART_PERIOD_OPTIONS,
  CHART_TITLES,
  catalogForGroup,
  CHART_CATALOG_GROUPS,
  chartUsesMultiTags,
  chartUsesPeriod,
} from '../chartInspectorMeta';
import { ChromeAppearance } from '../shared/ChromeAppearance';

export type ChartInspectorProps = {
  selected: GraphicObjectDefinition;
  tagOptions: TagSummary[];
  tags?: TagSummary[];
  devices?: DeviceSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
};

export function ChartInspector({ selected, tagOptions, tags = tagOptions, devices = [], onUpdate }: ChartInspectorProps) {
  const type = selected.type;
  const title = CHART_TITLES[type] ?? 'Chart';
  const echartType = styleStr(selected, 'echartType', 'line');

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const selectedTagIds = selected.tagIds ?? (selected.tagId ? [selected.tagId] : []);
  const deviceId = selected.deviceId ?? selected.binding?.deviceId ?? '';
  const scopedFromDevice = deviceId ? tagsForDevice(tagOptions, deviceId) : tagOptions;
  const scopedTags = scopedFromDevice.length > 0 ? scopedFromDevice : tagOptions;

  const setDevice = (id: string | undefined) => {
    const nextScoped = id ? tagsForDevice(tagOptions, id) : tagOptions;
    const list = nextScoped.length > 0 ? nextScoped : tagOptions;
    const kept = selectedTagIds.filter((tid) => list.some((t) => t.id === tid));
    const autoTag = id ? inferDeviceNumericTag(tagOptions, id) : undefined;
    const nextIds = kept.length > 0 ? kept : (autoTag ? [autoTag] : []);
    onUpdate(selected.id, {
      deviceId: id,
      binding: { ...selected.binding, deviceId: id, tagId: nextIds[0] },
      tagIds: nextIds,
      tagId: nextIds[0],
    });
  };

  const toggleTag = (tagId: string) => {
    const ids = [...selectedTagIds];
    const idx = ids.indexOf(tagId);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(tagId);
    onUpdate(selected.id, { tagIds: ids, tagId: ids[0] || undefined, binding: { ...selected.binding, tagId: ids[0] } });
  };

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>{title}</h4>

      <label className="ins-row">
        <span>Chart Title</span>
        <input
          value={selected.text ?? ''}
          onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
          placeholder={selected.name ?? 'Chart'}
        />
      </label>

      {devices.length > 0 ? (
        <label className="ins-row">
          <span>Device</span>
          <select value={deviceId} onChange={(e) => setDevice(e.target.value || undefined)}>
            <option value="">— All Devices —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name ?? d.id}</option>
            ))}
          </select>
        </label>
      ) : null}

      {chartUsesMultiTags(type, echartType) ? (
        <div className="ins-subsec">
          <div className="ins-subsec-title">Tags Displayed in Chart</div>
          <div className="ins-tag-chips">
            {scopedTags.length === 0 ? (
              <p className="ins-hint">No tags in project — create tags in Monitor first</p>
            ) : (
              scopedTags.map((t) => {
                const on = selectedTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`ins-tag-chip${on ? ' active' : ''}`}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name ?? t.id}
                  </button>
                );
              })
            )}
          </div>
          {type === 'trend' && selectedTagIds.length === 0 ? (
            <label className="ins-row" style={{ marginTop: 8 }}>
              <span>Main Tag</span>
              <select
                value={selected.tagId ?? ''}
                onChange={(e) => onUpdate(selected.id, { tagId: e.target.value || undefined })}
              >
                <option value="">— Select —</option>
                {scopedTags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : (
        <label className="ins-row">
          <span>Tag</span>
          <select
            value={selected.tagId ?? ''}
            onChange={(e) => onUpdate(selected.id, { tagId: e.target.value || undefined })}
          >
            <option value="">— Select tag —</option>
            {tagOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
            ))}
          </select>
        </label>
      )}

      {chartUsesPeriod(type, echartType) ? (
        <label className="ins-row">
          <span>Time Range</span>
          <select
            value={styleStr(selected, 'period', styleStr(selected, 'chartPeriod', '24h'))}
            onChange={(e) => setStyle({ period: e.target.value, chartPeriod: e.target.value })}
          >
            {CHART_PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {type === 'echart' ? (
        <label className="ins-row">
          <span>Chart Type</span>
          <select
            value={echartType}
            onChange={(e) => setStyle({ echartType: e.target.value })}
          >
            {CHART_CATALOG_GROUPS.map((grp) => (
              <optgroup key={grp.id} label={grp.label}>
                {catalogForGroup(grp.id).map((o) => (
                  <option key={o.type} value={o.type}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : null}

      <div className="ins-grid2">
        <label className="ins-row">
          <span>Primary Color</span>
          <input
            type="color"
            value={hexForColorInput(styleStr(selected, 'chartPrimaryColor', '#087c8b'), '#087c8b')}
            onChange={(e) => setStyle({ chartPrimaryColor: e.target.value })}
          />
        </label>
        {type === 'trend' || type === 'echart' ? (
          <label className="ins-check ins-check-inline">
            <input
              type="checkbox"
              checked={styleBool(selected, 'showLegend', true)}
              onChange={(e) => setStyle({ showLegend: e.target.checked })}
            />
            <span>Show Legend</span>
          </label>
        ) : null}
      </div>

      {type === 'piechart' ? (
        <label className="ins-check">
          <input
            type="checkbox"
            checked={selected.style?.donut === true}
            onChange={(e) => setStyle({ donut: e.target.checked })}
          />
          <span>Donut (Hollow)</span>
        </label>
      ) : null}

      <ChromeAppearance
        selected={selected}
        setStyle={setStyle}
        textColor
        fillLabel="Chart Background"
        defaultFill="#ffffff"
        defaultTextColor="#334155"
      />

      <details className="ins-more ins-more-premium">
        <summary>Advanced Settings</summary>
        {type === 'trend' ? (
          <label className="ins-check">
            <input
              type="checkbox"
              checked={styleBool(selected, 'showAxes', true)}
              onChange={(e) => setStyle({ showAxes: e.target.checked })}
            />
            <span>Show Axes & Labels</span>
          </label>
        ) : null}
      </details>
    </section>
  );
}
