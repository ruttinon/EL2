import type { Point2 } from './snapGrid';
import { boundsFromPoints, buildRoomFromPolygon, type RoomBuildResult } from './roomBuilder';

export type WallSegmentLine = { start: Point2; end: Point2 };

const DEFAULT_TOLERANCE = 12;

function dist(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clusterPoints(points: Point2[], tolerance: number): Point2[] {
  const clusters: Point2[] = [];
  for (const p of points) {
    const hit = clusters.find((c) => dist(c, p) <= tolerance);
    if (hit) {
      hit.x = Math.round((hit.x + p.x) / 2);
      hit.y = Math.round((hit.y + p.y) / 2);
    } else {
      clusters.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
  }
  return clusters;
}

function nodeIndex(clusters: Point2[], p: Point2, tolerance: number): number {
  const i = clusters.findIndex((c) => dist(c, p) <= tolerance);
  return i >= 0 ? i : -1;
}

/** Extract wall center-line segments from layout wall objects */
export function extractWallSegmentsFromStyles(
  walls: Array<{ style?: Record<string, string | number | boolean | undefined>; x?: number; y?: number }>,
): WallSegmentLine[] {
  const segments: WallSegmentLine[] = [];
  for (const wall of walls) {
    const sx = Number(wall.style?.wallStartX ?? wall.x ?? 0);
    const sy = Number(wall.style?.wallStartY ?? wall.y ?? 0);
    const ex = Number(wall.style?.wallEndX ?? sx);
    const ey = Number(wall.style?.wallEndY ?? sy);
    if (dist({ x: sx, y: sy }, { x: ex, y: ey }) >= 8) {
      segments.push({ start: { x: sx, y: sy }, end: { x: ex, y: ey } });
    }
  }
  return segments;
}

function polygonArea(points: Point2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum / 2);
}

/** Find closed loops formed by connected wall segments (largest area first) */
export function findClosedWallLoops(segments: WallSegmentLine[], tolerance = DEFAULT_TOLERANCE): Point2[][] {
  if (segments.length < 3) return [];

  const endpoints = segments.flatMap((s) => [s.start, s.end]);
  const nodes = clusterPoints(endpoints, tolerance);
  if (nodes.length < 3) return [];

  const edges: Array<[number, number]> = [];
  for (const seg of segments) {
    const a = nodeIndex(nodes, seg.start, tolerance);
    const b = nodeIndex(nodes, seg.end, tolerance);
    if (a >= 0 && b >= 0 && a !== b) edges.push([a, b]);
  }

  const adj = new Map<number, number[]>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }

  const loops: Point2[][] = [];

  function walkLoop(start: number, next: number, prev: number, used: Set<string>): Point2[] | null {
    const path = [start, next];
    let current = next;
    let previous = start;
    while (current !== start) {
      const neighbors = adj.get(current) ?? [];
      const candidates = neighbors.filter((n) => n !== previous);
      let picked: number | null = null;
      for (const c of candidates) {
        const key = `${Math.min(current, c)}:${Math.max(current, c)}`;
        if (!used.has(key)) {
          picked = c;
          used.add(key);
          break;
        }
      }
      if (picked === null) return null;
      if (picked === start && path.length >= 2) {
        return path.map((i) => nodes[i]);
      }
      path.push(picked);
      previous = current;
      current = picked;
      if (path.length > edges.length + 2) return null;
    }
    return path.map((i) => nodes[i]);
  }

  for (const [a, b] of edges) {
    const used = new Set<string>([`${Math.min(a, b)}:${Math.max(a, b)}`]);
    const loop = walkLoop(a, b, -1, used);
    if (loop && loop.length >= 3) {
      const dup = loops.some((l) => l.length === loop.length && l.every((p, i) => dist(p, loop[i]) < tolerance));
      if (!dup) loops.push(loop);
    }
  }

  return loops.sort((a, b) => polygonArea(b) - polygonArea(a));
}

export function findLargestClosedWallLoop(segments: WallSegmentLine[], tolerance = DEFAULT_TOLERANCE): Point2[] | null {
  const loops = findClosedWallLoops(segments, tolerance);
  return loops[0] ?? null;
}

export function buildRoomFromWallLoop(segments: WallSegmentLine[], wallThickness = 16): RoomBuildResult | null {
  const loop = findLargestClosedWallLoop(segments);
  if (!loop || loop.length < 3) return null;
  return buildRoomFromPolygon(loop, wallThickness);
}

export function roomBoundsFromLoop(loop: Point2[]) {
  return boundsFromPoints(loop);
}
