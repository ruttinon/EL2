import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { GAUGE_STYLE_CATALOG, gaugeStyleUsesMultiTag } from '@energylink/graphics-runtime';
import { inferDeviceNumericTag, tagsForDevice } from '@energylink/widget-registry';
import { hexForColorInput } from '../../colorInput';
import { mergeStyle, styleNum, styleStr } from '../../editor/inspector/inspectorUtils';
import { ChromeAppearance } from '../../editor/inspector/shared/ChromeAppearance';
import { DeviceTagBinding } from './DeviceTagBinding';

function pickTagsForDevice(allTags: TagSummary[], deviceId: string): TagSummary[] {
  const scoped = deviceId ? tagsForDevice(allTags, deviceId) : allTags;
  return scoped.length > 0 ? scoped : allTags;
}

export function GaugeMiniInspector({
  selected,
  devices,
  tags,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  devices: DeviceSummary[];
  tags: TagSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const gaugeStyle = styleStr(selected, 'gaugeStyle', 'classic');
  const multiTag = gaugeStyleUsesMultiTag(gaugeStyle);
  const selectedTagIds = selected.tagIds ?? (selected.tagId ? [selected.tagId] : []);
  const deviceId = selected.deviceId ?? selected.binding?.deviceId ?? '';
  const scopedTags = pickTagsForDevice(tags, deviceId);

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const bindDevice = (id: string | undefined) => {
    const nextScoped = pickTagsForDevice(tags, id ?? '');
    const autoTag = id ? inferDeviceNumericTag(tags, id) : undefined;
    const kept = selectedTagIds.filter((tid) => nextScoped.some((t) => t.id === tid));
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
      <h4>Gauge</h4>

      <label className="ins-row">
        <span>FormatGauge</span>
        <select
          value={gaugeStyle}
          onChange={(e) => setStyle({ gaugeStyle: e.target.value })}
        >
          {GAUGE_STYLE_CATALOG.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
      </label>

      {multiTag ? (
        <>
          {devices.length > 0 ? (
            <label className="ins-row">
              <span>Device</span>
              <select value={deviceId} onChange={(e) => bindDevice(e.target.value || undefined)}>
                <option value="">— EveryDevice —</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name ?? d.id}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="ins-subsec">
            <div className="ins-subsec-title">
              {gaugeStyle === 'vu' || gaugeStyle === 'dual' ? 'Tags (Left · Right)' : 'Tags inGauge'}
            </div>
            <div className="ins-tag-chips">
              {scopedTags.length === 0 ? (
                <p className="ins-hint">No tags available for this device.</p>
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
            {gaugeStyle === 'vu' || gaugeStyle === 'dual' ? (
              <p className="ins-hint">Select 1 tag = Both Needles · 2 tags = Left/Right</p>
            ) : null}
          </div>
        </>
      ) : (
        <DeviceTagBinding
          selected={selected}
          devices={devices}
          tags={tags}
          onUpdate={onUpdate}
          inferTag={inferDeviceNumericTag}
          tagLabel="Measurement Tag"
        />
      )}

      <div className="ins-grid2">
        <label className="ins-row"><span>Min</span>
          <input type="number" value={styleNum(selected, 'min', 0)} onChange={(e) => setStyle({ min: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Max</span>
          <input type="number" value={styleNum(selected, 'max', 100)} onChange={(e) => setStyle({ max: Number(e.target.value) })} />
        </label>
      </div>
      <label className="ins-row"><span>Unit</span>
        <input value={styleStr(selected, 'unit', '%')} onChange={(e) => setStyle({ unit: e.target.value })} placeholder="V, kW, %" />
      </label>

      {gaugeStyle !== 'classic' ? (
        <label className="ins-row">
          <span>Primary Color</span>
          <input
            type="color"
            value={hexForColorInput(styleStr(selected, 'chartPrimaryColor', styleStr(selected, 'color', '#087c8b')), '#087c8b')}
            onChange={(e) => setStyle({ chartPrimaryColor: e.target.value, color: e.target.value })}
          />
        </label>
      ) : null}

      <ChromeAppearance selected={selected} setStyle={setStyle} textColor fillLabel="Gauge Background" defaultFill="#ffffff" />
    </section>
  );
}
