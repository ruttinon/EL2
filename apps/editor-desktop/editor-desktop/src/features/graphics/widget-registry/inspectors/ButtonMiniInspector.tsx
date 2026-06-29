import type { DeviceSummary, GraphicObjectDefinition, GraphicSummary, TagSummary } from '@energylink/shared-types';
import { inferDeviceCommandTag } from '@energylink/widget-registry';
import { hexForColorInput } from '../../colorInput';
import { mergeStyle, styleNum, styleStr } from '../../editor/inspector/inspectorUtils';
import { ChromeAppearance } from '../../editor/inspector/shared/ChromeAppearance';
import { DeviceTagBinding } from './DeviceTagBinding';

type ButtonActionMode = 'write' | 'navigate';

function resolveButtonActionMode(selected: GraphicObjectDefinition): ButtonActionMode {
  const stored = selected.style?.buttonActionMode;
  if (stored === 'write' || stored === 'navigate') return stored;
  return selected.navigateTo && !selected.tagId ? 'navigate' : 'write';
}

export function ButtonMiniInspector({
  selected,
  devices,
  tags,
  graphics,
  currentGraphicId,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  devices: DeviceSummary[];
  tags: TagSummary[];
  graphics: GraphicSummary[];
  currentGraphicId: string | null;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };
  const actionMode = resolveButtonActionMode(selected);
  const targetGraphics = graphics.filter((g) => g.id !== currentGraphicId);

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>Button Controls</h4>

      <label className="ins-row">
        <span>Button Text</span>
        <input value={selected.text ?? ''} onChange={(e) => onUpdate(selected.id, { text: e.target.value })} placeholder="Start / Go to Screen" />
      </label>

      <div className="ins-grid2">
        <label className="ins-row">
          <span>Mode</span>
          <select value={actionMode} onChange={(e) => setStyle({ buttonActionMode: e.target.value as ButtonActionMode })}>
            <option value="write">Write Value</option>
            <option value="navigate">Navigate Page</option>
          </select>
        </label>

        <label className="ins-row">
          <span>Font Size</span>
          <input
            type="number"
            min={8}
            max={72}
            value={styleNum(selected, 'fontSize', 14)}
            onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
          />
        </label>
      </div>

      {actionMode === 'navigate' ? (
        <label className="ins-row">
          <span>Navigate To</span>
          <select
            value={selected.navigateTo ?? ''}
            onChange={(e) => onUpdate(selected.id, { navigateTo: e.target.value || undefined })}
          >
            <option value="">— Select Screen —</option>
            {targetGraphics.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <DeviceTagBinding
            selected={selected}
            devices={devices}
            tags={tags}
            onUpdate={onUpdate}
            inferTag={inferDeviceCommandTag}
            tagLabel="Target Tag"
            hint="Select device — auto-selects command tag"
          />

          <label className="ins-row">
            <span>Write Value</span>
            <input value={styleStr(selected, 'writeValue', '')} onChange={(e) => setStyle({ writeValue: e.target.value })} placeholder="1 / true" />
          </label>

          <label className="ins-check">
            <input type="checkbox" checked={selected.style?.confirmWrite === true} onChange={(e) => setStyle({ confirmWrite: e.target.checked })} />
            <span>Confirm Before Write</span>
          </label>
        </>
      )}

      <label className="ins-row">
        <span>Opacity</span>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={styleNum(selected, 'opacity', 1)}
          onChange={(e) => setStyle({ opacity: Number(e.target.value) })}
        />
      </label>

      <label className="ins-row">
        <span>Border Color</span>
        <input
          type="color"
          value={hexForColorInput(styleStr(selected, 'stroke', '#db2777'), '#db2777')}
          onChange={(e) => setStyle({ stroke: e.target.value, borderColor: e.target.value })}
        />
      </label>

      <ChromeAppearance selected={selected} setStyle={setStyle} textColor fillLabel="Button Color" defaultFill="#ec4899" defaultTextColor="#ffffff" />

      <div className="ins-grid2">
        <label className="ins-row">
          <span>Border Width</span>
          <input
            type="number"
            min={0}
            max={12}
            value={styleNum(selected, 'strokeWidth', 1)}
            onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })}
          />
        </label>

        <label className="ins-row">
          <span>Border Radius</span>
          <input
            type="number"
            min={0}
            max={64}
            value={styleNum(selected, 'borderRadius', 8)}
            onChange={(e) => setStyle({ borderRadius: Number(e.target.value) })}
          />
        </label>
      </div>
    </section>
  );
}
