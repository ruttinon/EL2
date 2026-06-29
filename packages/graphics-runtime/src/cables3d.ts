import { applySceneDefaultsToStyle } from '@energylink/shared-types';
import { parsePorts, findPort, portCanvasPosition } from './ports';

export type Point3 = { x: number; y: number; z: number };

/** Parse "x,y,z;x2,y2,z2" — absolute canvas coords or 0–1 normalized */
export function parsePath3d(raw: unknown, width: number, height: number): Point3[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const points: Point3[] = [];
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [xs, ys, zs] = trimmed.split(',').map((s) => s.trim());
    const x = Number(xs);
    const y = Number(ys);
    const z = Number(zs ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({
      x: x <= 1 && x >= 0 && width > 1 ? x * width : x,
      y: y <= 1 && y >= 0 && height > 1 ? y * height : y,
      z: Number.isFinite(z) ? (z <= 1 && z >= 0 ? z * Math.min(width, height) : z) : 0,
    });
  }
  return points;
}

/** Parse path3d string with absolute canvas coordinates (from wire/cable tools) */
export function parsePath3dAbsolute(raw: unknown): Point3[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const points: Point3[] = [];
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [xs, ys, zs] = trimmed.split(',').map((s) => s.trim());
    const x = Number(xs);
    const y = Number(ys);
    const z = Number(zs ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x, y, z: Number.isFinite(z) ? z : 0 });
  }
  return points;
}

export function formatPath3d(points: Point3[], width: number, height: number): string {
  const scale = Math.min(width, height) || 1;
  return points
    .map((p) => `${(p.x / width).toFixed(3)},${(p.y / height).toFixed(3)},${(p.z / scale).toFixed(3)}`)
    .join(';');
}

/** Isometric-ish projection of 3D path to 2D canvas points for SVG render */
export function projectPath3dTo2d(points: Point3[]): Array<{ x: number; y: number }> {
  return points.map((p) => ({
    x: p.x + p.z * 0.45,
    y: p.y - p.z * 0.55,
  }));
}

export function path3dBoundingBox(points: Point3[], pad = 12): {
  pathPoints: string;
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { pathPoints: '0,0;100,0', x: 0, y: 0, width: 100, height: 24 };
  }
  const projected = projectPath3dTo2d(points);
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  const width = Math.max(24, maxX - minX);
  const height = Math.max(24, maxY - minY);
  const pathPoints = projected
    .map((p) => `${(p.x - minX).toFixed(1)},${(p.y - minY).toFixed(1)}`)
    .join(';');
  return { pathPoints, x: minX, y: minY, width, height };
}

export function resolveCableEndpoints(style: Record<string, unknown> | undefined) {
  if (!style) return {};
  return {
    fromObjectId: style.fromObjectId != null ? String(style.fromObjectId) : undefined,
    fromPortId: style.fromPortId != null ? String(style.fromPortId) : undefined,
    toObjectId: style.toObjectId != null ? String(style.toObjectId) : undefined,
    toPortId: style.toPortId != null ? String(style.toPortId) : undefined,
    linkedWireId: style.linkedWireId != null ? String(style.linkedWireId) : undefined,
  };
}

type LayoutObject = {
  id: string;
  type: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  locked?: boolean;
  layer?: number;
  style?: Record<string, string | number | boolean | undefined>;
};

export function createCable3dFromPorts(
  fromObj: LayoutObject,
  fromPortId: string,
  toObj: LayoutObject,
  toPortId: string,
  id: string,
  name: string,
  linkedWireId?: string,
): LayoutObject {
  const fromPort = findPort(parsePorts(fromObj.style?.ports), fromPortId);
  const toPort = findPort(parsePorts(toObj.style?.ports), toPortId);
  if (!fromPort || !toPort) throw new Error('Port not found');

  const fromPos = portCanvasPosition(fromObj, fromPort);
  const toPos = portCanvasPosition(toObj, toPort);
  const midZ = Math.min(fromObj.height, toObj.height) * 0.35;

  const path3d = [
    { x: fromPos.x, y: fromPos.y, z: 0 },
    { x: (fromPos.x + toPos.x) / 2, y: (fromPos.y + toPos.y) / 2, z: midZ },
    { x: toPos.x, y: toPos.y, z: 0 },
  ];
  const geom = path3dBoundingBox(path3d);

  return {
    id,
    type: 'cable3d',
    name,
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    visible: true,
    locked: false,
    layer: Date.now(),
    style: applySceneDefaultsToStyle('cable3d', {
      path3d: path3d.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`).join(';'),
      pathPoints: geom.pathPoints,
      cableRadius: 3,
      flowColor: '#a78bfa',
      idleColor: '#64748b',
      flowThreshold: 0.5,
      strokeWidth: 6,
      flowSpeed: 1,
      fromObjectId: fromObj.id,
      fromPortId,
      toObjectId: toObj.id,
      toPortId,
      linkedWireId,
    }),
  };
}

export function updateConnectedCables(objects: LayoutObject[], movedObjectId: string): LayoutObject[] {
  return objects.map((obj) => {
    if (obj.type !== 'cable3d') return obj;
    const endpoints = resolveCableEndpoints(obj.style);
    if (endpoints.fromObjectId !== movedObjectId && endpoints.toObjectId !== movedObjectId) return obj;
    if (!endpoints.fromObjectId || !endpoints.fromPortId || !endpoints.toObjectId || !endpoints.toPortId) return obj;

    const fromObj = objects.find((o) => o.id === endpoints.fromObjectId);
    const toObj = objects.find((o) => o.id === endpoints.toObjectId);
    if (!fromObj || !toObj) return obj;

    try {
      const next = createCable3dFromPorts(
        fromObj,
        endpoints.fromPortId,
        toObj,
        endpoints.toPortId,
        obj.id,
        obj.name ?? 'Cable 3D',
        endpoints.linkedWireId,
      );
      return { ...next, layer: obj.layer, locked: obj.locked, style: { ...next.style, linkedWireId: endpoints.linkedWireId } };
    } catch {
      return obj;
    }
  });
}

/** Sync cable path from linked 2D flowpath wire */
export function syncCableFromLinkedWire(objects: LayoutObject[], cableId: string): LayoutObject[] {
  const cable = objects.find((o) => o.id === cableId && o.type === 'cable3d');
  if (!cable) return objects;
  const linkedId = resolveCableEndpoints(cable.style).linkedWireId;
  if (!linkedId) return objects;
  const wire = objects.find((o) => o.id === linkedId && o.type === 'flowpath');
  if (!wire?.style?.pathPoints) return objects;

  const pts2d = String(wire.style.pathPoints).split(';').map((part) => {
    const [xs, ys] = part.split(',').map((s) => s.trim());
    return { x: Number(xs) + wire.x, y: Number(ys) + wire.y };
  }).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  if (pts2d.length < 2) return objects;

  const path3d = pts2d.map((p, i) => ({
    x: p.x,
    y: p.y,
    z: i === 0 || i === pts2d.length - 1 ? 0 : Math.min(wire.width, wire.height) * 0.3,
  }));
  const geom = path3dBoundingBox(path3d);

  return objects.map((o) => o.id !== cableId ? o : {
    ...o,
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    style: {
      ...o.style,
      path3d: path3d.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`).join(';'),
      pathPoints: geom.pathPoints,
    },
  });
}
