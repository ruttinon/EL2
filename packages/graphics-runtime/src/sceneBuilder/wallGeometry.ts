import type { Point2 } from './snapGrid';

export type WallSegmentGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  len: number;
  angleDeg: number;
  wallStartX: number;
  wallStartY: number;
  wallEndX: number;
  wallEndY: number;
  wallThickness: number;
};

export function computeWallSegment(
  start: Point2,
  end: Point2,
  thickness = 16,
): WallSegmentGeometry {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.max(20, Math.round(Math.sqrt(dx * dx + dy * dy)));
  const angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y) - thickness / 2,
    width: len,
    height: thickness,
    len,
    angleDeg,
    wallStartX: start.x,
    wallStartY: start.y,
    wallEndX: end.x,
    wallEndY: end.y,
    wallThickness: thickness,
  };
}
