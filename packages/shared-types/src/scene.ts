/** Scene composition — render modes, layers, real-world scale (Phase 8) */

/** @deprecated Pre-unified 2D/3D/Dual toggle — use defaultCamera + unified layers */
export type GraphicSceneViewMode = '2d' | '3d' | 'dual';

export type GraphicRenderMode = 'scene' | 'wire' | 'panel' | 'overlay';
export type GraphicSceneLayer = 'background' | 'scene' | 'wiring' | 'equipment' | 'overlay';
export type GraphicCameraPreset = 'free' | 'isometric' | 'top' | 'juddesk';

export const DEFAULT_MM_PER_PX = 10;

const SCENE_TYPES = new Set(['image', 'viewport3d', 'scene3d', 'sprite', 'lottie', 'elecsymbol', 'hotspot', 'zone3d', 'zone2d', 'bussection']);
const WIRE_TYPES = new Set(['flowpath', 'cable3d', 'pipe']);
const OVERLAY_TYPES = new Set(['value', 'sparkline', 'alarm', 'statusbadge', 'status', 'led', 'multistate', 'text', 'formulavalue', 'feedlabel', 'clock']);

export function defaultRenderModeForType(type: string): GraphicRenderMode {
  if (WIRE_TYPES.has(type)) return 'wire';
  if (SCENE_TYPES.has(type)) return 'scene';
  if (OVERLAY_TYPES.has(type)) return 'overlay';
  return 'panel';
}

export function defaultSceneLayerForType(type: string): GraphicSceneLayer {
  if (['image', 'panel', 'rectangle', 'line', 'circle', 'polygon'].includes(type)) return 'background';
  if (type === 'viewport3d' || type === 'scene3d') return 'scene';
  if (WIRE_TYPES.has(type)) return 'wiring';
  if (['elecsymbol', 'hotspot', 'sprite', 'lottie', 'zone3d', 'zone2d', 'bussection'].includes(type)) return 'equipment';
  return 'overlay';
}

export function resolveRenderMode(obj: { type: string; style?: Record<string, unknown> }): GraphicRenderMode {
  const raw = obj.style?.renderMode;
  if (raw === 'scene' || raw === 'wire' || raw === 'panel' || raw === 'overlay') return raw;
  return defaultRenderModeForType(obj.type);
}

export function resolveSceneLayer(obj: { type: string; style?: Record<string, unknown> }): GraphicSceneLayer {
  const raw = obj.style?.sceneLayer;
  const layers: GraphicSceneLayer[] = ['background', 'scene', 'wiring', 'equipment', 'overlay'];
  if (typeof raw === 'string' && layers.includes(raw as GraphicSceneLayer)) return raw as GraphicSceneLayer;
  return defaultSceneLayerForType(obj.type);
}

export function isChromelessRenderMode(mode: GraphicRenderMode): boolean {
  return mode === 'scene' || mode === 'wire' || mode === 'overlay';
}

export function dimensionsFromRealWorld(
  realWidthMm: number,
  realHeightMm: number,
  mmPerPx: number = DEFAULT_MM_PER_PX,
): { width: number; height: number } {
  const scale = mmPerPx > 0 ? mmPerPx : DEFAULT_MM_PER_PX;
  return {
    width: Math.max(12, Math.round(realWidthMm / scale)),
    height: Math.max(12, Math.round(realHeightMm / scale)),
  };
}

export function applySceneDefaultsToStyle(
  type: string,
  style: Record<string, string | number | boolean | undefined> = {},
): Record<string, string | number | boolean | undefined> {
  const renderMode = (style.renderMode ?? defaultRenderModeForType(type)) as GraphicRenderMode;
  const sceneLayer = (style.sceneLayer ?? defaultSceneLayerForType(type)) as GraphicSceneLayer;
  const next: Record<string, string | number | boolean | undefined> = { ...style, renderMode, sceneLayer };
  if (isChromelessRenderMode(renderMode)) {
    if (next.background === undefined || next.background === '#ffffff') next.background = 'transparent';
    if (next.stroke === undefined || next.stroke === '#9fc4cc') {
      next.stroke = renderMode === 'wire' ? 'transparent' : (next.stroke ?? 'transparent');
    }
  }
  return next;
}

export const SCENE_LAYER_GROUPS: Array<{ id: GraphicSceneLayer; label: string }> = [
  { id: 'background', label: 'Background' },
  { id: 'scene', label: 'Scene 3D' },
  { id: 'wiring', label: 'Wiring' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'overlay', label: 'Data Overlay' },
];
