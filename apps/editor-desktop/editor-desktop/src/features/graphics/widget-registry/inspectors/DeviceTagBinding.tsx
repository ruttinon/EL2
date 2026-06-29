import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { tagsForDevice } from '@energylink/widget-registry';

export type DeviceTagBindingProps = {
  selected: GraphicObjectDefinition;
  devices: DeviceSummary[];
  tags: TagSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  /** Auto-pick tag when device changes */
  inferTag?: (tags: TagSummary[], deviceId: string) => string | undefined;
  tagLabel?: string;
  hint?: string;
};

export function DeviceTagBinding({
  selected,
  devices,
  tags,
  onUpdate,
  inferTag,
  tagLabel = 'Target Tag',
  hint = 'Select a Device. The system will automatically pick a matching tag if available.',
}: DeviceTagBindingProps) {
  const deviceId = selected.deviceId ?? '';
  const scopedTags = deviceId ? tagsForDevice(tags, deviceId) : tags;

  const bindDevice = (id: string | undefined) => {
    const tagId = id && inferTag ? inferTag(tags, id) : undefined;
    const dev = id ? devices.find((d) => d.id === id) : undefined;
    onUpdate(selected.id, {
      deviceId: id,
      tagId: tagId ?? (id ? undefined : selected.tagId),
      binding: { ...selected.binding, tagId: tagId ?? (id ? undefined : selected.binding?.tagId) },
      name: dev && !selected.name?.trim() ? `${dev.name}` : selected.name,
    });
  };

  const bindTag = (tagId: string | undefined) => {
    const tag = tags.find((t) => t.id === tagId);
    onUpdate(selected.id, {
      tagId,
      deviceId: tag ? (tag.deviceId ?? tag.device_id) ?? selected.deviceId : selected.deviceId,
      binding: { ...selected.binding, tagId },
    });
  };

  if (devices.length === 0) return null;

  return (
    <>
      <p className="ins-hint">{hint}</p>
      <label className="ins-row">
        <span>Device</span>
        <select value={deviceId} onChange={(e) => bindDevice(e.target.value || undefined)}>
          <option value="">— Select Device —</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name ?? d.id}</option>
          ))}
        </select>
      </label>
      <label className="ins-row">
        <span>{tagLabel}</span>
        <select
          value={selected.tagId ?? selected.binding?.tagId ?? ''}
          onChange={(e) => bindTag(e.target.value || undefined)}
        >
          <option value="">{deviceId && inferTag ? '— Auto-selected (Change to override) —' : '— Select Tag —'}</option>
          {scopedTags.map((t) => (
            <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
          ))}
        </select>
      </label>
    </>
  );
}
