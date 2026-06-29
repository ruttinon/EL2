import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { resolveRenderMode, resolveSceneLayer, resolveUnifiedLayer } from '@energylink/shared-types';

const SLAB_TYPES = new Set(['rectangle', 'panel', 'image', 'circle', 'ellipse', 'polygon', 'elecsymbol']);

/** Scene/backdrop shapes that should render as WebGL meshes in Top/Orbit — not flat GraphicStage tiles */
export function shouldRenderAsWorldSlab(obj: GraphicObjectDefinition): boolean {
  if (obj.visible === false) return false;
  if (resolveUnifiedLayer(obj) === 'world') return false;
  const mode = resolveRenderMode(obj);
  const layer = resolveSceneLayer(obj);
  if (mode === 'scene' && SLAB_TYPES.has(obj.type)) return true;
  if (layer === 'background' && SLAB_TYPES.has(obj.type)) return true;
  return false;
}

export function shouldHideFromDiagramIn3d(obj: GraphicObjectDefinition): boolean {
  if (shouldRenderAsWorldSlab(obj)) return true;
  const mode = resolveRenderMode(obj);
  if (mode === 'wire' && (obj.type === 'flowpath' || obj.type === 'pipe')) return true;
  return false;
}
