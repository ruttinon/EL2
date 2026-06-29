import { computeWallSegment } from '@energylink/graphics-runtime';
import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { makeObject } from './objectCatalog';

/** Build a wall object from two canvas points (Juddesk / scene-builder style). */
export function buildWallFromPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  zTop: number,
): GraphicObjectDefinition {
  const segment = computeWallSegment(start, end);
  const obj = makeObject('wall', segment.x, segment.y, zTop);
  return {
    ...obj,
    width: segment.width,
    height: segment.height,
    style: {
      ...obj.style,
      background: '#94a3b8',
      fill: '#94a3b8',
      stroke: '#64748b',
      strokeWidth: 1,
      wallHeight3d: 80,
      wallThickness: segment.wallThickness,
      wallAngleDeg: segment.angleDeg,
      wallStartX: segment.wallStartX,
      wallStartY: segment.wallStartY,
      wallEndX: segment.wallEndX,
      wallEndY: segment.wallEndY,
      renderMode: 'scene',
    },
  };
}

export function appendPathPoint(
  obj: GraphicObjectDefinition,
  canvasX: number,
  canvasY: number,
): string {
  const lx = Math.round(canvasX - obj.x);
  const ly = Math.round(canvasY - obj.y);
  const current = String(obj.style?.pathPoints ?? '');
  return current ? `${current};${lx},${ly}` : `${lx},${ly}`;
}
