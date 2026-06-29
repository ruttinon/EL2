import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { defaultBoxDepth } from './boxDepth';
import { resolveAssetRef, loadGraphicAssets } from './graphicAssets';

export { defaultBoxDepth } from './boxDepth';

function resolveStoredUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return resolveAssetRef(raw, loadGraphicAssets()) || raw;
}

export function resolveImageUrl(obj: GraphicObjectDefinition): string | undefined {
  const top = (obj as { imageDataUrl?: string }).imageDataUrl;
  const styled = obj.style?.imageDataUrl;
  const ref = obj.style?.imageAssetRef;
  if (typeof ref === 'string' && ref) return resolveStoredUrl(ref);
  if (typeof top === 'string' && top) return resolveStoredUrl(top);
  if (typeof styled === 'string' && styled) return resolveStoredUrl(styled);
  return undefined;
}

export function resolveBoxFaceImage(obj: GraphicObjectDefinition): string | undefined {
  const face = obj.style?.boxFaceImage;
  if (typeof face === 'string' && face) return face;
  if (obj.type === 'image') return resolveImageUrl(obj);
  return undefined;
}

/** Only explicit viewport3d box mode — never pseudo-3D flat images */
export function shouldExtrudeAs3dBox(obj: GraphicObjectDefinition): boolean {
  const mode = String(obj.style?.sceneBuildMode ?? 'box');
  return obj.type === 'viewport3d' && mode !== 'glb' && mode !== 'spline';
}

export function shouldShowImageOnCanvas(obj: GraphicObjectDefinition): boolean {
  const url = resolveImageUrl(obj);
  if (!url) return false;
  if (obj.type === 'image') return true;
  return (obj as { displayMode?: string }).displayMode === 'image';
}

/** Premium defaults: free-floating image without forced box chrome. */
export const FREE_IMAGE_STYLE = {
  imageFrameMode: 'free' as const,
  transparentBg: true,
  fill: 'transparent',
  background: 'transparent',
  strokeWidth: 0,
  stroke: 'transparent',
  borderColor: 'transparent',
  objectFit: 'contain' as const,
};

export function imageObjectPatch(dataUrl: string, imageId?: string, ref?: string) {
  const url = ref ?? dataUrl;
  return {
    imageId,
    imageDataUrl: url,
    displayMode: 'image' as const,
    style: {
      imageDataUrl: url,
      imageAssetRef: ref,
      ...FREE_IMAGE_STYLE,
    },
  };
}

/** Style patch for viewport3d box from an image URL */
export function imageTo3dBoxStyle(
  dataUrl: string,
  width: number,
  height: number,
  extra?: Record<string, unknown>,
) {
  return {
    sceneBuildMode: 'box',
    boxFaceImage: dataUrl,
    boxColor: '#64748b',
    boxDepth: defaultBoxDepth(width, height),
    depthZ: 24,
    autoRotate: false,
    cameraPreset: 'isometric',
    imageDataUrl: dataUrl,
    ...extra,
  };
}
