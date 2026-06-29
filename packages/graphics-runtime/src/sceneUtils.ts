import type React from 'react';
import {
  resolveRenderMode,
  resolveSceneLayer,
  isChromelessRenderMode,
  type GraphicRenderMode,
} from '@energylink/shared-types';

export {
  resolveRenderMode,
  resolveSceneLayer,
  isChromelessRenderMode,
  defaultRenderModeForType,
  defaultSceneLayerForType,
  dimensionsFromRealWorld,
  applySceneDefaultsToStyle,
  DEFAULT_MM_PER_PX,
  SCENE_LAYER_GROUPS,
} from '@energylink/shared-types';

export type { GraphicRenderMode, GraphicSceneLayer, GraphicCameraPreset } from '@energylink/shared-types';

export function applyChromelessStyle(
  style: React.CSSProperties,
  obj: { type: string; style?: Record<string, string | number | boolean | undefined> },
): React.CSSProperties {
  const mode = resolveRenderMode(obj);
  if (!isChromelessRenderMode(mode)) return style;
  return {
    ...style,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
  };
}

export type ObjectFitMode = 'contain' | 'cover' | 'fill' | 'none';

export function resolveObjectFit(raw: unknown): ObjectFitMode {
  if (raw === 'cover' || raw === 'fill' || raw === 'none') return raw;
  return 'contain';
}

/** Resolve asset:// refs and pass through http/data URLs. */
export function resolveMediaSrc(
  raw: string | undefined,
  resolver?: (ref: string) => string,
): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('asset://')) return resolver?.(raw) || undefined;
  return raw;
}
/** True when image/video should render without chrome box (SCADA overlay style). */
export function isFreeMediaFrame(style: Record<string, unknown> | undefined): boolean {
  if (!style) return false;
  if (style.imageFrameMode === 'free' || style.mediaFrameMode === 'free') return true;
  if (style.transparentBg === true) return true;
  const bg = String(style.background ?? style.fill ?? '').toLowerCase();
  return bg === 'transparent' || bg === 'none';
}

export function resolveCameraOrbit(preset: unknown): string {
  if (preset === 'top') return '0deg 90deg auto';
  if (preset === 'isometric' || preset === 'juddesk') return '45deg 55deg auto';
  return 'auto auto auto';
}

/** R3F orthographic camera position for scene presets */
export function resolveR3fCameraPosition(
  width: number,
  height: number,
  preset: unknown,
): [number, number, number] {
  const cx = width / 2;
  const cy = -height / 2;
  if (preset === 'top') return [cx, cy, 1200];
  if (preset === 'juddesk') return [cx + width * 0.55, cy - height * 0.45, width * 0.85];
  if (preset === 'isometric') return [cx + width * 0.42, cy - height * 0.38, width * 0.72];
  return [cx, cy, 1000];
}
