import type { GraphicLayout, GraphicObjectDefinition } from '@energylink/shared-types';
import { normalizeGraphicLayout } from '@energylink/shared-types';
import { resolveUnifiedLayer } from '@energylink/shared-types';

export { normalizeGraphicLayout } from '@energylink/shared-types';

export function layoutV1ToV2(layout: GraphicLayout): GraphicLayout {
  return normalizeGraphicLayout(layout);
}

export function splitObjectsByUnifiedLayer(objects: GraphicObjectDefinition[]) {
  const world: GraphicObjectDefinition[] = [];
  const diagram: GraphicObjectDefinition[] = [];
  const hud: GraphicObjectDefinition[] = [];
  for (const obj of objects) {
    if (obj.visible === false) continue;
    const layer = resolveUnifiedLayer(obj);
    if (layer === 'world') world.push(obj);
    else if (layer === 'hud') hud.push(obj);
    else diagram.push(obj);
  }
  return { world, diagram, hud, flat: [...diagram, ...hud] };
}
