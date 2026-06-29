import type { DeviceSummary, GraphicObjectDefinition } from '@energylink/shared-types';
import { resolveAssetRef, loadGraphicAssets } from './graphicAssets';

export function resolveDeviceIconUrl(device: Pick<DeviceSummary, 'imageDataUrl'> | null | undefined): string {
  return device?.imageDataUrl?.trim() ?? '';
}

export function resolveDeviceModel3dUrl(
  device: Pick<DeviceSummary, 'model3dUrl'> | null | undefined,
): string {
  const raw = device?.model3dUrl?.trim() ?? '';
  if (!raw) return '';
  return resolveAssetRef(raw, loadGraphicAssets()) || raw;
}

export type ImageSource = 'device' | 'custom' | 'none';

export function readImageSource(obj: GraphicObjectDefinition): ImageSource {
  const src = obj.style?.imageSource;
  if (src === 'device' || src === 'custom' || src === 'none') return src;
  if (obj.imageDataUrl || obj.style?.imageDataUrl) return 'custom';
  return 'none';
}

/** Apply device 2D icon to a graphic object. */
export function patchFromDeviceIcon(
  device: DeviceSummary,
  existing?: GraphicObjectDefinition,
): Partial<GraphicObjectDefinition> {
  const url = resolveDeviceIconUrl(device);
  if (!url) return { deviceId: device.id };
  return {
    deviceId: device.id,
    imageDataUrl: url,
    displayMode: 'image',
    style: {
      ...existing?.style,
      imageSource: 'device',
      imageDataUrl: url,
      objectFit: 'contain',
    },
  };
}

/** Apply device GLB to viewport3d / scene3d object. */
export function patchFromDeviceModel3d(
  device: DeviceSummary,
  existing?: GraphicObjectDefinition,
): Partial<GraphicObjectDefinition> {
  const glbUrl = resolveDeviceModel3dUrl(device);
  if (!glbUrl) return { deviceId: device.id };
  return {
    deviceId: device.id,
    style: {
      ...existing?.style,
      modelSource: 'device',
      sceneBuildMode: 'glb',
      glbUrl,
    },
  };
}

/** Place new viewport3d object config from device model. */
export function makeViewport3dFromDevice(
  device: DeviceSummary,
  x: number,
  y: number,
  w = 260,
  h = 200,
): Partial<GraphicObjectDefinition> {
  const glbUrl = resolveDeviceModel3dUrl(device);
  return {
    type: 'viewport3d',
    name: device.name,
    deviceId: device.id,
    x: Math.round(x - w / 2),
    y: Math.round(y - h / 2),
    width: w,
    height: h,
    style: {
      sceneBuildMode: glbUrl ? 'glb' : 'box',
      glbUrl: glbUrl || undefined,
      modelSource: 'device',
      autoRotate: false,
      objectFit: 'contain',
    },
  };
}

/** Place new image object from device icon. */
export function makeImageFromDevice(
  device: DeviceSummary,
  x: number,
  y: number,
  size = 120,
): Partial<GraphicObjectDefinition> | null {
  const url = resolveDeviceIconUrl(device);
  if (!url) return null;
  return {
    type: 'image',
    name: device.name,
    deviceId: device.id,
    x: Math.round(x - size / 2),
    y: Math.round(y - size / 2),
    width: size,
    height: size,
    imageDataUrl: url,
    displayMode: 'image',
    style: {
      imageSource: 'device',
      imageDataUrl: url,
      objectFit: 'contain',
    },
  };
}
