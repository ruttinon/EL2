/** Phase 15 — 2D/3D grid snap for scene builder */

export type Point2 = { x: number; y: number };

export const DEFAULT_GRID_SIZE = 20;
export const SNAP3D_GRID = 20;

export function snapValue(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(point: Point2, gridSize: number, enabled: boolean): Point2 {
  return {
    x: snapValue(point.x, gridSize, enabled),
    y: snapValue(point.y, gridSize, enabled),
  };
}

export function snapDepthZ(depthZ: number, enabled: boolean, gridSize = SNAP3D_GRID): number {
  if (!enabled) return depthZ;
  return Math.round(depthZ / gridSize) * gridSize;
}
