import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { resolveUnifiedLayer } from '@energylink/shared-types';
import { resolveFloorVisible } from '@energylink/graphics-runtime';
import { shouldExtrudeAs3dBox } from './extrude3d';
import { shouldHideFromDiagramIn3d } from './worldMesh';

export type DiagramObjectFilterOptions = {
  is3dCamera?: boolean;
  activeFloor?: number | null;
};

function passesBaseDiagramFilter(
  obj: GraphicObjectDefinition,
  options: DiagramObjectFilterOptions,
): boolean {
  const { is3dCamera = false, activeFloor = null } = options;
  if (obj.visible === false) return false;
  if (!resolveFloorVisible(obj, activeFloor)) return false;
  if (shouldExtrudeAs3dBox(obj)) return false;
  if (is3dCamera && shouldHideFromDiagramIn3d(obj)) return false;
  if (is3dCamera && resolveUnifiedLayer(obj) === 'world') return false;
  if (obj.type === 'cable3d' && obj.style?.viewportHostId) return false;
  return true;
}

/** Objects rendered by GraphicStage in the editor (diagram + hud, flat mode) */
export function filterDiagramStageObjects(
  objects: GraphicObjectDefinition[],
  options: DiagramObjectFilterOptions = {},
): GraphicObjectDefinition[] {
  return objects.filter((obj) => passesBaseDiagramFilter(obj, options) && obj.type !== 'wall');
}

/** Diagram-layer objects only (SLD, equipment, wiring) */
export function filterDiagramOnlyStageObjects(
  objects: GraphicObjectDefinition[],
  options: DiagramObjectFilterOptions = {},
): GraphicObjectDefinition[] {
  return objects.filter(
    (obj) => passesBaseDiagramFilter(obj, options) && resolveUnifiedLayer(obj) === 'diagram' && obj.type !== 'wall',
  );
}

/** HUD-layer objects (gauges, values — float above 3D scene) */
export function filterHudStageObjects(
  objects: GraphicObjectDefinition[],
  options: DiagramObjectFilterOptions = {},
): GraphicObjectDefinition[] {
  return objects.filter((obj) => passesBaseDiagramFilter(obj, options) && resolveUnifiedLayer(obj) === 'hud');
}

/** Objects that need editor hit-targets / wall chrome on top of the stage */
export function filterDiagramInteractionObjects(
  objects: GraphicObjectDefinition[],
  options: DiagramObjectFilterOptions = {},
): GraphicObjectDefinition[] {
  return objects.filter((obj) => passesBaseDiagramFilter(obj, options));
}

export function filterDiagramOnlyInteractionObjects(
  objects: GraphicObjectDefinition[],
  options: DiagramObjectFilterOptions = {},
): GraphicObjectDefinition[] {
  return filterDiagramInteractionObjects(objects, options).filter((o) => resolveUnifiedLayer(o) === 'diagram');
}

export function filterHudInteractionObjects(
  objects: GraphicObjectDefinition[],
  options: DiagramObjectFilterOptions = {},
): GraphicObjectDefinition[] {
  return filterDiagramInteractionObjects(objects, options).filter((o) => resolveUnifiedLayer(o) === 'hud');
}
