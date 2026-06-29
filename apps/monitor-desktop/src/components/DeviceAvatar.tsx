import React from 'react';
import { Cpu, Gauge, Radio } from 'lucide-react';
import type { RuntimeDevice } from '../types/monitor';
import { deviceVisualKind, getDeviceImageSrc } from '../utils/deviceVisual';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'hero' | 'showcase';

const SIZE_CLASS: Record<Size, string> = {
  xs: 'device-avatar-xs',
  sm: 'device-avatar-sm',
  md: 'device-avatar-md',
  lg: 'device-avatar-lg',
  hero: 'device-avatar-hero',
  showcase: 'device-avatar-showcase',
};

const ICON_SIZE: Record<Size, number> = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 22,
  hero: 32,
  showcase: 40,
};

export function DeviceAvatar({
  device,
  size = 'md',
  className,
}: {
  device: RuntimeDevice;
  size?: Size;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);
  const src = getDeviceImageSrc(device);
  const kind = deviceVisualKind(device.type);
  const iconSize = ICON_SIZE[size];

  const fallbackIcon =
    kind === 'converter'
      ? <Radio size={iconSize} />
      : kind === 'meter'
        ? <Gauge size={iconSize} />
        : <Cpu size={iconSize} />;

  const classes = `device-avatar ${SIZE_CLASS[size]} device-avatar-${kind}${className ? ` ${className}` : ''}`;

  if (src && !broken) {
    return (
      <div className={classes}>
        <img
          src={src}
          alt={device.name}
          className="device-avatar-img"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div className={classes}>
      <span className="device-avatar-fallback" aria-hidden="true">{fallbackIcon}</span>
    </div>
  );
}
