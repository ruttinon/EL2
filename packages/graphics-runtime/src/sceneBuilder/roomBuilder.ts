import type { Point2 } from './snapGrid';
import { computeWallSegment, type WallSegmentGeometry } from './wallGeometry';

export const MIN_ROOM_SIZE = 40;
export const ROOM_CORNER_COUNT = 4;
export const MIN_ROOM_CORNERS = 3;

export type RoomBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RoomBuildResult = {
  bounds: RoomBounds;
  polygonPoints: string;
  walls: WallSegmentGeometry[];
};

export function boundsFromPoints(points: Point2[]): RoomBounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(MIN_ROOM_SIZE, maxX - minX),
    height: Math.max(MIN_ROOM_SIZE, maxY - minY),
  };
}

export function polygonPointsString(points: Point2[]): string {
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
}

function shoelaceArea(points: Point2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum / 2);
}

export function validateRoomPolygon(points: Point2[]): string | null {
  if (points.length < MIN_ROOM_CORNERS) {
    return `Room needs at least ${MIN_ROOM_CORNERS} corners (have ${points.length})`;
  }
  const bounds = boundsFromPoints(points);
  if (bounds.width < MIN_ROOM_SIZE || bounds.height < MIN_ROOM_SIZE) {
    return `Room must be at least ${MIN_ROOM_SIZE}px wide and tall`;
  }
  if (shoelaceArea(points) < MIN_ROOM_SIZE * MIN_ROOM_SIZE / 2) {
    return 'Room polygon area is too small';
  }
  return null;
}

export function validateRoomCorners(points: Point2[]): string | null {
  if (points.length !== ROOM_CORNER_COUNT) {
    return `Room tool needs ${ROOM_CORNER_COUNT} corners (have ${points.length})`;
  }
  return validateRoomPolygon(points);
}

export function buildRoomFromPolygon(points: Point2[], wallThickness = 16): RoomBuildResult {
  const error = validateRoomPolygon(points);
  if (error) throw new Error(error);

  const bounds = boundsFromPoints(points);
  const walls: WallSegmentGeometry[] = [];
  for (let i = 0; i < points.length; i++) {
    walls.push(computeWallSegment(points[i], points[(i + 1) % points.length], wallThickness));
  }

  return {
    bounds,
    polygonPoints: polygonPointsString(points),
    walls,
  };
}

export function buildRoomFromCorners(points: Point2[], wallThickness = 16): RoomBuildResult {
  const error = validateRoomCorners(points);
  if (error) throw new Error(error);
  return buildRoomFromPolygon(points, wallThickness);
}
