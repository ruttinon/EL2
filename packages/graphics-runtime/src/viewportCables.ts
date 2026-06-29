import type { NormalizedGraphicObject } from './types';
import { parsePath3dAbsolute, type Point3 } from './cables3d';
import { parsePathPoints, pathMidpoint } from './sld';

/** Cables linked to a viewport host (filter only — keeps canvas-absolute geometry). */
export function filterInlayCablesForViewport(
  host: NormalizedGraphicObject,
  peers: NormalizedGraphicObject[] = [],
): NormalizedGraphicObject[] {
  return peers.filter((o) => {
    if (o.type !== 'cable3d' || o.visible === false) return false;
    if (String(o.style?.viewportHostId ?? '') === host.id) return true;
    const pts = parsePathPoints(o.style?.pathPoints as string | undefined, o.width, o.height);
    if (pts.length === 0) return false;
    const mid = pathMidpoint(pts);
    const ax = mid.x + o.x;
    const ay = mid.y + o.y;
    return ax >= host.x && ax <= host.x + host.width && ay >= host.y && ay <= host.y + host.height;
  });
}

/** Cables rendered inside a viewport3d host (flat SVG inlay — local 2D path). */
export function inlayCablesForViewport(
  host: NormalizedGraphicObject,
  peers: NormalizedGraphicObject[] = [],
): NormalizedGraphicObject[] {
  return filterInlayCablesForViewport(host, peers).map((o) => cableToViewportLocal2d(o, host));
}

export function cableToViewportLocal2d(
  cable: NormalizedGraphicObject,
  host: NormalizedGraphicObject,
): NormalizedGraphicObject {
  const pathPoints = String(cable.style?.pathPoints ?? '');
  if (!pathPoints.trim()) return { ...cable, x: 0, y: 0, width: host.width, height: host.height };
  const localPath = pathPoints
    .split(';')
    .map((part) => {
      const [xs, ys] = part.split(',').map((s) => s.trim());
      const ax = Number(xs) + cable.x - host.x;
      const ay = Number(ys) + cable.y - host.y;
      return `${ax},${ay}`;
    })
    .join(';');
  return {
    ...cable,
    x: 0,
    y: 0,
    width: host.width,
    height: host.height,
    style: { ...cable.style, pathPoints: localPath },
  };
}

/** Absolute canvas path points for a cable (prefers path3d, falls back to pathPoints). */
export function resolveCableAbsolutePath3d(cable: NormalizedGraphicObject): Point3[] {
  const raw3d = parsePath3dAbsolute(cable.style?.path3d);
  if (raw3d.length >= 2) return raw3d;
  const pts2d = parsePathPoints(cable.style?.pathPoints as string | undefined, cable.width, cable.height);
  if (pts2d.length < 2) return [];
  return pts2d.map((p, i) => ({
    x: p.x + cable.x,
    y: p.y + cable.y,
    z: i === 0 || i === pts2d.length - 1 ? 0 : Math.min(cable.width, cable.height) * 0.25,
  }));
}

/** Map canvas-absolute path into viewport-host local 3D coords (centered on host, Y-up). */
export function cablePathInViewportHostSpace(
  cable: NormalizedGraphicObject,
  host: NormalizedGraphicObject,
): Point3[] {
  const cx = host.x + host.width / 2;
  const cy = host.y + host.height / 2;
  return resolveCableAbsolutePath3d(cable).map((p) => ({
    x: p.x - cx,
    y: -(p.y - cy),
    z: p.z ?? 0,
  }));
}
