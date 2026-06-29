import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { inferDeviceCommandTag } from '@energylink/widget-registry';
import { mergeStyle, styleStr } from '../../editor/inspector/inspectorUtils';
import { ChromeAppearance } from '../../editor/inspector/shared/ChromeAppearance';
import { DeviceTagBinding } from './DeviceTagBinding';

export function SwitchMiniInspector({
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
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>Switch</h4>
      <DeviceTagBinding
        selected={selected}
        devices={devices}
        tags={tags}
        onUpdate={onUpdate}
        inferTag={inferDeviceCommandTag}
        tagLabel="Target Tag (bool)"
        hint="Select Device — System will auto-select a boolean tag."
      />
      <label className="ins-check">
        <input type="checkbox" checked={selected.style?.confirmWrite === true} onChange={(e) => setStyle({ confirmWrite: e.target.checked })} />
        <span>Confirm Before Write</span>
      </label>
      <ChromeAppearance selected={selected} setStyle={setStyle} textColor fillLabel="Switch Color" defaultFill="#e2e8f0" />
    </section>
  );
}
