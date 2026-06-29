import { Upload, X } from 'lucide-react';
import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { inferDeviceStatusTag } from '@energylink/widget-registry';
import { hexForColorInput } from '../../colorInput';
import { styleStr, readAsDataUrl } from '../../editor/inspector/inspectorUtils';

type StatusVariant = 'lamp' | 'badge' | 'image' | 'model3d';

export function StatusMiniInspector({
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
  const deviceId = selected.deviceId ?? '';
  const deviceTags = tags.filter((t) => !deviceId || (t.deviceId ?? t.device_id) === deviceId);
  const variant = (styleStr(selected, 'statusVariant', 'lamp') as StatusVariant) || 'lamp';

  const setStyle = (patch: Record<string, string>) => {
    onUpdate(selected.id, { style: { ...selected.style, ...patch } });
  };

  const bindDevice = (id: string | undefined) => {
    const tagId = id ? inferDeviceStatusTag(tags, id) : undefined;
    onUpdate(selected.id, {
      deviceId: id,
      tagId,
      binding: { ...selected.binding, tagId },
      name: id && !selected.name?.trim()
        ? `${devices.find((d) => d.id === id)?.name ?? id}_Status`
        : selected.name,
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

  const setVariant = (next: StatusVariant) => {
    const patch: Partial<GraphicObjectDefinition> = {
      style: {
        ...selected.style,
        statusVariant: next,
        valueDisplayMode: next === 'model3d' ? 'model3d' : next === 'image' ? 'image' : 'classic',
      },
    };
    if (next === 'badge') {
      patch.width = Math.max(selected.width, 130);
      patch.height = Math.max(selected.height, 40);
    } else {
      patch.width = Math.max(selected.width, 48);
      patch.height = Math.max(selected.height, 48);
    }
    onUpdate(selected.id, patch);
  };

  const clearAsset = (key: string) => {
    const nextStyle = { ...selected.style };
    delete (nextStyle as Record<string, unknown>)[key];
    onUpdate(selected.id, { style: nextStyle });
  };

  const pickAsset = async (key: string, file?: File | null) => {
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    setStyle({ [key]: dataUrl });
  };

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>Status Indicator</h4>
      <p className="ins-hint">Select a Device to automatically track its status.</p>

      <label className="ins-row">
        <span>Device</span>
        <select value={deviceId} onChange={(e) => bindDevice(e.target.value || undefined)}>
          <option value="">— No Device (Manual Tag) —</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name ?? d.id}</option>
          ))}
        </select>
      </label>

      {/* Show tag override if needed */}
      <details className="ins-composer-group" open={!deviceId || !selected.tagId}>
        <summary>Status Tag Override</summary>
        <div className="ins-composer-fields">
          <p className="ins-hint">Override the default status tag associated with this device.</p>
          <label className="ins-row">
            <span>Status Tag</span>
            <select
              value={selected.tagId ?? selected.binding?.tagId ?? ''}
              onChange={(e) => bindTag(e.target.value || undefined)}
            >
              <option value="">— Select Tag —</option>
              {(deviceId ? deviceTags : tags).map((t) => (
                <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <label className="ins-row">
        <span>Format</span>
        <select value={variant} onChange={(e) => setVariant(e.target.value as StatusVariant)}>
          <option value="lamp">Shape Indicator (Lamp)</option>
          <option value="badge">Text Badge</option>
          <option value="image">Custom Image</option>
          <option value="model3d">3D Model (.glb)</option>
        </select>
      </label>

      {variant === 'lamp' ? (
        <>
          <p className="ins-hint">Colors are applied based on the tag's boolean state.</p>
          <div className="ins-grid2">
            <label className="ins-row">
              <span>Color (ON)</span>
              <input
                type="color"
                value={hexForColorInput(styleStr(selected, 'onColor', '#22c55e'), '#22c55e')}
                onChange={(e) => setStyle({ onColor: e.target.value })}
              />
            </label>
            <label className="ins-row">
              <span>Color (OFF)</span>
              <input
                type="color"
                value={hexForColorInput(styleStr(selected, 'offColor', '#94a3b8'), '#94a3b8')}
                onChange={(e) => setStyle({ offColor: e.target.value })}
              />
            </label>
          </div>
          <label className="ins-row">
            <span>Shape</span>
            <select
              value={styleStr(selected, 'lampShape', 'circle')}
              onChange={(e) => {
                const shape = e.target.value;
                const radius = shape === 'circle' ? '50%' : shape === 'square' ? '4px' : '12px';
                setStyle({ lampShape: shape, valueBorderRadius: radius });
              }}
            >
              <option value="circle">Circle</option>
              <option value="rounded">Rounded</option>
              <option value="square">Square</option>
            </select>
          </label>
        </>
      ) : variant === 'badge' ? (
        <>
          <label className="ins-row ins-row-stack">
            <span>Value Map</span>
            <input
              value={styleStr(selected, 'badgeMap', '0:Offline:#94a3b8,1:Online:#22c55e,2:Fault:#ef4444')}
              onChange={(e) => setStyle({ badgeMap: e.target.value })}
              placeholder="0:Offline:#94a3b8,1:Online:#22c55e"
            />
          </label>
          <p className="ins-hint">Format: `value:text:color` separated by commas</p>
          <label className="ins-row">
            <span>Default Text</span>
            <input
              value={selected.text ?? ''}
              onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
              placeholder="Online / Running…"
            />
          </label>
        </>
      ) : variant === 'image' ? (
        <div className="ins-grid2">
          {styleStr(selected, 'stateOnImage', '') ? (
            <div className="ins-media">
              <img className="ins-thumb" src={styleStr(selected, 'stateOnImage', '')} alt="" />
              <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearAsset('stateOnImage')}><X size={14} /></button>
            </div>
          ) : (
            <label className="ins-file-btn"><Upload size={14} /> Image ON…
              <input type="file" accept="image/*" hidden onChange={(e) => void pickAsset('stateOnImage', e.target.files?.[0])} />
            </label>
          )}
          {styleStr(selected, 'stateOffImage', '') ? (
            <div className="ins-media">
              <img className="ins-thumb" src={styleStr(selected, 'stateOffImage', '')} alt="" />
              <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearAsset('stateOffImage')}><X size={14} /></button>
            </div>
          ) : (
            <label className="ins-file-btn"><Upload size={14} /> Image OFF…
              <input type="file" accept="image/*" hidden onChange={(e) => void pickAsset('stateOffImage', e.target.files?.[0])} />
            </label>
          )}
        </div>
      ) : variant === 'model3d' ? (
        <div className="ins-grid2">
          {styleStr(selected, 'stateOnGlb', '') ? (
            <div className="ins-media">
              <span className="ins-file-name">ON 3D ✓</span>
              <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearAsset('stateOnGlb')}><X size={14} /></button>
            </div>
          ) : (
            <label className="ins-file-btn"><Upload size={14} /> 3D Model ON…
              <input type="file" accept=".glb,.gltf" hidden onChange={(e) => void pickAsset('stateOnGlb', e.target.files?.[0])} />
            </label>
          )}
          {styleStr(selected, 'stateOffGlb', '') ? (
            <div className="ins-media">
              <span className="ins-file-name">OFF 3D ✓</span>
              <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearAsset('stateOffGlb')}><X size={14} /></button>
            </div>
          ) : (
            <label className="ins-file-btn"><Upload size={14} /> 3D Model OFF…
              <input type="file" accept=".glb,.gltf" hidden onChange={(e) => void pickAsset('stateOffGlb', e.target.files?.[0])} />
            </label>
          )}
        </div>
      ) : null}
    </section>
  );
}
