/** Unified frame — one viewport, world / diagram / hud layers (layout v2) */

export type GraphicUnifiedLayer = 'world' | 'diagram' | 'hud';

export type UnifiedCameraPreset = 'flat' | 'top' | 'orbit';

export type GraphicTransform3d = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

const WORLD_TYPES = new Set([
  'wall',
  'viewport3d',
  'scene3d',
  'zone3d',
  'cable3d',
]);

const HUD_TYPES = new Set([
  'value',
  'gauge',
  'trend',
  'alarm',
  'sparkline',
  'barchart',
  'piechart',
  'kpicard',
  'formulavalue',
  'statusbadge',
  'tagtable',
  'alarmtable',
  'button',
  'switch',
  'slider',
  'levelbar',
  'navbutton',
  'tabbar',
  'led',
  'multistate',
  'clock',
  'progressbar',
  'semaphore',
  'inputfield',
  'dropdown',
  'echart',
]);

export function defaultUnifiedLayerForType(type: string): GraphicUnifiedLayer {
  if (WORLD_TYPES.has(type)) return 'world';
  if (HUD_TYPES.has(type)) return 'hud';
  return 'diagram';
}

export function resolveUnifiedLayer(obj: {
  type: string;
  style?: Record<string, unknown>;
}): GraphicUnifiedLayer {
  const raw = obj.style?.unifiedLayer;
  if (raw === 'world' || raw === 'diagram' || raw === 'hud') return raw;
  return defaultUnifiedLayerForType(obj.type);
}

export function unifiedCameraToR3fPreset(camera: UnifiedCameraPreset): string {
  if (camera === 'top') return 'top';
  if (camera === 'orbit') return 'juddesk';
  return 'top';
}

export function shouldMountWorldLayer(
  camera: UnifiedCameraPreset,
  hasWorldObjects: boolean,
): boolean {
  if (!hasWorldObjects) return false;
  return camera === 'top' || camera === 'orbit';
}

/** Map legacy layout.sceneViewMode to unified defaultCamera (v1 → v2). */
export function legacySceneViewModeToDefaultCamera(mode: unknown): UnifiedCameraPreset | null {
  if (mode === '3d') return 'orbit';
  if (mode === '2d' || mode === 'dual') return 'flat';
  return null;
}
