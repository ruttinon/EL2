import type { DeviceSummary, GraphicObjectDefinition } from '@energylink/shared-types';
import { mergeStyle, styleBool, styleNum, styleStr } from '../inspectorUtils';
import { ChromeAppearance } from '../shared/ChromeAppearance';

export type TableInspectorProps = {
  selected: GraphicObjectDefinition;
  devices: DeviceSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
};

export function TableInspector({ selected, devices, onUpdate }: TableInspectorProps) {
  const type = selected.type;
  const title = type === 'alarmtable' ? 'Alarm Table' : 'Tag Table';

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const deviceId = selected.deviceId ?? selected.binding?.deviceId ?? '';

  const setDeviceFilter = (id: string) => {
    onUpdate(selected.id, {
      deviceId: id || undefined,
      binding: { ...selected.binding, deviceId: id || undefined },
    });
  };

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>{title}</h4>

      <label className="ins-row">
        <span>Table Title</span>
        <input
          value={selected.text ?? ''}
          onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
          placeholder={selected.name ?? 'Table'}
        />
      </label>

      <label className="ins-row">
        <span>Filter by Device</span>
        <select
          value={selected.deviceId ?? ''}
          onChange={(e) => onUpdate(selected.id, { deviceId: e.target.value || undefined })}
        >
          <option value="">— All Devices —</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>

      <label className="ins-row">
        <span>Max Rows</span>
        <input
          type="number"
          min={3}
          max={50}
          value={styleNum(selected, 'maxRows', 10)}
          onChange={(e) => setStyle({ maxRows: Number(e.target.value) })}
        />
      </label>

      {type === 'alarmtable' ? (
        <>
          <label className="ins-row">
            <span>Severity Filter</span>
            <select
              value={styleStr(selected, 'severityFilter', 'all')}
              onChange={(e) => setStyle({ severityFilter: e.target.value })}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </label>
          <label className="ins-check">
            <input
              type="checkbox"
              checked={styleBool(selected, 'alarmSound', false)}
              onChange={(e) => setStyle({ alarmSound: e.target.checked })}
            />
            <span>Sound on new alarm</span>
          </label>
        </>
      ) : (
        <>
          <label className="ins-row">
            <span>Columns (comma separated)</span>
            <input
              value={styleStr(selected, 'columns', 'name,value,unit')}
              onChange={(e) => setStyle({ columns: e.target.value })}
              placeholder="name,value,unit,quality,device"
            />
          </label>
          <label className="ins-check">
            <input
              type="checkbox"
              checked={styleBool(selected, 'exportCsv', false)}
              onChange={(e) => setStyle({ exportCsv: e.target.checked })}
            />
            <span>Show Export CSV Button</span>
          </label>
        </>
      )}

      <ChromeAppearance
        selected={selected}
        setStyle={setStyle}
        textColor
        fontSize
        fillLabel="Table Background Color"
        defaultFill="#ffffff"
        defaultTextColor="#142033"
      />
    </section>
  );
}
