import type { UnifiedCameraPreset } from '@energylink/shared-types';

const LABELS: Record<UnifiedCameraPreset, string> = {
  flat: 'Monitor',
  top: 'Top',
  orbit: 'Orbit 3D',
};

export function CameraToolbar({
  value,
  onChange,
  className,
}: {
  value: UnifiedCameraPreset;
  onChange: (preset: UnifiedCameraPreset) => void;
  className?: string;
}) {
  const presets: UnifiedCameraPreset[] = ['flat', 'top', 'orbit'];
  return (
    <div className={`uv-camera-toolbar${className ? ` ${className}` : ''}`} role="group" aria-label="Camera">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          className={`uv-camera-btn${value === p ? ' active' : ''}`}
          onClick={() => onChange(p)}
          title={LABELS[p]}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
