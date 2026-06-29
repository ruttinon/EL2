import type { Point2 } from './snapGrid';
import type { WallSegmentLine } from './wallLoop';

export type WallSnapResult = {
  point: Point2;
  angleDeg: number;
  distance: number;
};

function distToSegment(p: Point2, a: Point2, b: Point2): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return { dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return { dist: Math.hypot(p.x - px, p.y - py), t };
}

/** Snap placement point to nearest wall segment within maxDistance */
export function snapPointToWall(
  point: Point2,
  segments: WallSegmentLine[],
  maxDistance = 24,
): WallSnapResult | null {
  let best: WallSnapResult | null = null;
  for (const seg of segments) {
    const { dist, t } = distToSegment(point, seg.start, seg.end);
    if (dist > maxDistance) continue;
    const px = seg.start.x + t * (seg.end.x - seg.start.x);
    const py = seg.start.y + t * (seg.end.y - seg.start.y);
    const angleDeg = Math.round((Math.atan2(seg.end.y - seg.start.y, seg.end.x - seg.start.x) * 180) / Math.PI);
    if (!best || dist < best.distance) {
      best = { point: { x: Math.round(px), y: Math.round(py) }, angleDeg, distance: dist };
    }
  }
  return best;
}
