import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { inferDeviceStatusTag } from '@energylink/widget-registry';
import { styleStr } from '../../editor/inspector/inspectorUtils';
import { DeviceTagBinding } from './DeviceTagBinding';

const SYMBOL_OPTIONS = [
  { value: 'breaker', label: 'Breaker' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'motor', label: 'Motor' },
  { value: 'generator', label: 'Generator' },
  { value: 'meter', label: 'Meter' },
  { value: 'ats', label: 'ATS' },
  { value: 'disconnect', label: 'Disconnect' },
];

export function ElecSymbolMiniInspector({
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
  return (
    <section className="ins-sec ins-sec-premium">
      <h4>Electrical Symbol</h4>
      <label className="ins-row">
        <span>Symbol Type</span>
        <select
          value={styleStr(selected, 'symbolId', 'breaker')}
          onChange={(e) => onUpdate(selected.id, { style: { ...selected.style, symbolId: e.target.value } })}
        >
          {SYMBOL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <DeviceTagBinding
        selected={selected}
        devices={devices}
        tags={tags}
        onUpdate={onUpdate}
        inferTag={inferDeviceStatusTag}
        tagLabel="Status Tag"
        hint="Select Device — System will auto-select the breaker's On/Off Status tag."
      />
      <label className="ins-row">
        <span>Label</span>
        <input value={selected.text ?? ''} onChange={(e) => onUpdate(selected.id, { text: e.target.value })} />
      </label>
    </section>
  );
}
