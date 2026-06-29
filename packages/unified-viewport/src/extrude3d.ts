import type { GraphicObjectDefinition } from '@energylink/shared-types';

export function shouldExtrudeAs3dBox(obj: GraphicObjectDefinition): boolean {
  const mode = String(obj.style?.sceneBuildMode ?? 'box');
  return obj.type === 'viewport3d' && mode !== 'glb' && mode !== 'spline';
}
