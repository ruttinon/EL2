import type { ReactNode } from 'react';
import type { DeviceSummary, GraphicObjectDefinition, GraphicSummary, TagSummary } from '@energylink/shared-types';
import { inferDeviceCommandTag, inferDeviceNumericTag } from '@energylink/widget-registry';
import { mergeStyle, styleNum, styleStr } from '../../editor/inspector/inspectorUtils';
import { ChromeAppearance } from '../../editor/inspector/shared/ChromeAppearance';
import { DeviceTagBinding } from './DeviceTagBinding';

function ControlSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ins-sec ins-sec-premium">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

export function SliderMiniInspector({
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
    <ControlSection title="Slider">
      <DeviceTagBinding
        selected={selected}
        devices={devices}
        tags={tags}
        onUpdate={onUpdate}
        inferTag={inferDeviceNumericTag}
        tagLabel="Target Tag"
      />
      <div className="ins-grid2">
        <label className="ins-row"><span>Min</span>
          <input type="number" value={styleNum(selected, 'min', 0)} onChange={(e) => setStyle({ min: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Max</span>
          <input type="number" value={styleNum(selected, 'max', 100)} onChange={(e) => setStyle({ max: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Step</span>
          <input type="number" min={0} value={styleNum(selected, 'step', 1)} onChange={(e) => setStyle({ step: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Unit</span>
          <input value={styleStr(selected, 'unit', '%')} onChange={(e) => setStyle({ unit: e.target.value })} />
        </label>
      </div>
      <label className="ins-check">
        <input type="checkbox" checked={selected.style?.confirmWrite === true} onChange={(e) => setStyle({ confirmWrite: e.target.checked })} />
        <span>Confirm Before Write</span>
      </label>
    </ControlSection>
  );
}

export function InputMiniInspector({
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
    <ControlSection title="Input Field">
      <DeviceTagBinding
        selected={selected}
        devices={devices}
        tags={tags}
        onUpdate={onUpdate}
        inferTag={inferDeviceCommandTag}
        tagLabel="Target Tag"
      />
      <label className="ins-row">
        <span>Placeholder</span>
        <input value={styleStr(selected, 'placeholder', '')} onChange={(e) => setStyle({ placeholder: e.target.value })} />
      </label>
      <label className="ins-check">
        <input type="checkbox" checked={selected.style?.confirmWrite === true} onChange={(e) => setStyle({ confirmWrite: e.target.checked })} />
        <span>Confirm Before Write</span>
      </label>
      <ChromeAppearance selected={selected} setStyle={setStyle} textColor fillLabel="Background" defaultFill="#ffffff" />
    </ControlSection>
  );
}

export function DropdownMiniInspector({
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
    <ControlSection title="Dropdown">
      <DeviceTagBinding
        selected={selected}
        devices={devices}
        tags={tags}
        onUpdate={onUpdate}
        inferTag={inferDeviceCommandTag}
        tagLabel="Target Tag"
      />
      <label className="ins-row ins-row-stack">
        <span>ItemsSelect (separated by ,)</span>
        <input
          value={styleStr(selected, 'options', 'Auto,Manual,Off')}
          onChange={(e) => setStyle({ options: e.target.value })}
          placeholder="Auto,Manual,Off"
        />
      </label>
      <label className="ins-check">
        <input type="checkbox" checked={selected.style?.confirmWrite === true} onChange={(e) => setStyle({ confirmWrite: e.target.checked })} />
        <span>Confirm Before Write</span>
      </label>
      <ChromeAppearance selected={selected} setStyle={setStyle} textColor fillLabel="Background" defaultFill="#ffffff" />
    </ControlSection>
  );
}

export function NavMiniInspector({
  selected,
  graphics,
  currentGraphicId,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  graphics: GraphicSummary[];
  currentGraphicId: string | null;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  return (
    <ControlSection title="Navigation Button">
      <label className="ins-row">
        <span>Button Text</span>
        <input value={selected.text ?? ''} onChange={(e) => onUpdate(selected.id, { text: e.target.value })} />
      </label>
      <label className="ins-row">
        <span>Navigate To</span>
        <select
          value={selected.navigateTo ?? ''}
          onChange={(e) => onUpdate(selected.id, { navigateTo: e.target.value || undefined })}
        >
          <option value="">— Select Screen —</option>
          {graphics.filter((g) => g.id !== currentGraphicId).map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>
    </ControlSection>
  );
}

export function TabbarMiniInspector({
  selected,
  graphics,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  graphics: GraphicSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <ControlSection title="Tab Bar">
      <p className="ins-hint">Format: `Tab Label:Screen ID` separated by commas</p>
      <label className="ins-row ins-row-stack">
        <span>Tab</span>
        <input
          value={styleStr(selected, 'tabs', '')}
          onChange={(e) => setStyle({ tabs: e.target.value })}
          placeholder="Overview:graphic_main,Alarms:graphic_alarms"
        />
      </label>
      {graphics.length > 0 ? (
        <details className="ins-hint-block">
          <summary>Available Screens in System</summary>
          <ul className="ins-mini-list">
            {graphics.map((g) => (
              <li key={g.id}><code>{g.name}:{g.id}</code></li>
            ))}
          </ul>
        </details>
      ) : null}
    </ControlSection>
  );
}
