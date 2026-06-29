import { Icon } from '@iconify/react';
import type { GraphicAsset, GraphicAssetKind } from '@energylink/shared-types';

const KIND_LABELS: Record<GraphicAssetKind, string> = {
  image: 'Image',
  model3d: '3D Model',
  lottie: 'Lottie',
  video: 'Video',
  sprite: 'Sprite',
  svg: 'SVG',
  spline: 'Spline',
  html: 'HTML',
};

export function GraphicAssetPicker({
  assets,
  kind,
  value,
  onChange,
  label = 'Asset',
}: {
  assets: GraphicAsset[];
  kind?: GraphicAssetKind;
  value: string;
  onChange: (url: string, asset?: GraphicAsset) => void;
  label?: string;
}) {
  const filtered = kind ? assets.filter((a) => a.kind === kind) : assets;

  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => {
          const url = e.target.value;
          onChange(url, filtered.find((a) => a.url === url));
        }}
      >
        <option value="">— Select from library —</option>
        {filtered.map((asset) => (
          <option key={asset.id} value={asset.url}>
            {asset.name} ({KIND_LABELS[asset.kind]})
          </option>
        ))}
      </select>
      {filtered.length === 0 ? (
        <span className="prop-hint" style={{ display: 'block', marginTop: 4 }}>
          No {kind ? KIND_LABELS[kind] : ''} assets — import in Setup → Assets
        </span>
      ) : null}
      {value && kind === 'model3d' ? (
        <span className="prop-hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Icon icon="solar:cube-bold-duotone" width="14" height="14" /> GLB/GLTF linked
        </span>
      ) : null}
    </label>
  );
}
