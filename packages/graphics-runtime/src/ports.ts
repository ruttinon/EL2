import {
  parsePorts,
  formatPorts,
  DEFAULT_ELEC_PORTS,
  DEFAULT_EQUIPMENT_PORTS,
  DEFAULT_BUS_PORTS,
  applySceneDefaultsToStyle,
  type GraphicPort,
} from '@energylink/shared-types';

export {
  parsePorts,
  formatPorts,
  DEFAULT_ELEC_PORTS,
  DEFAULT_EQUIPMENT_PORTS,
  DEFAULT_BUS_PORTS,
  type GraphicPort,
  type PortKind,
  type WireEndpoint,
} from '@energylink/shared-types';

export type PortAnchor = { canvasX: number; canvasY: number; port: GraphicPort };

export function defaultPortsForType(type: string): string {
  if (type === 'bussection') return DEFAULT_BUS_PORTS;
  if (type === 'elecsymbol') return DEFAULT_ELEC_PORTS;
  if (type === 'image' || type === 'viewport3d' || type === 'scene3d') return DEFAULT_EQUIPMENT_PORTS;
  return '';
}

export function portCanvasPosition(
  obj: { x: number; y: number; width: number; height: number },
  port: GraphicPort,
): { x: number; y: number } {
  return {
    x: obj.x + port.x * obj.width,
    y: obj.y + port.y * obj.height,
  };
}

/** Build pathPoints for a flowpath/wire object spanning two canvas points */
export function pathPointsBetween(
  from: { x: number; y: number },
  to: { x: number; y: number },
  wireX: number,
  wireY: number,
): { pathPoints: string; x: number; y: number; width: number; height: number } {
  const pad = 8;
  const minX = Math.min(from.x, to.x) - pad;
  const minY = Math.min(from.y, to.y) - pad;
  const maxX = Math.max(from.x, to.x) + pad;
  const maxY = Math.max(from.y, to.y) + pad;
  const width = Math.max(24, maxX - minX);
  const height = Math.max(24, maxY - minY);
  const x1 = from.x - minX;
  const y1 = from.y - minY;
  const x2 = to.x - minX;
  const y2 = to.y - minY;
  return {
    pathPoints: `${x1.toFixed(1)},${y1.toFixed(1)};${x2.toFixed(1)},${y2.toFixed(1)}`,
    x: minX,
    y: minY,
    width,
    height,
  };
}

export function resolveWireEndpoints(style: Record<string, unknown> | undefined): {
  fromObjectId?: string;
  fromPortId?: string;
  toObjectId?: string;
  toPortId?: string;
} {
  if (!style) return {};
  return {
    fromObjectId: style.fromObjectId != null ? String(style.fromObjectId) : undefined,
    fromPortId: style.fromPortId != null ? String(style.fromPortId) : undefined,
    toObjectId: style.toObjectId != null ? String(style.toObjectId) : undefined,
    toPortId: style.toPortId != null ? String(style.toPortId) : undefined,
  };
}

export function findPort(ports: GraphicPort[], portId: string): GraphicPort | undefined {
  return ports.find((p) => p.id === portId);
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

export type NearestPortHit = {
  objectId: string;
  port: GraphicPort;
  x: number;
  y: number;
  distance: number;
};

/** Find nearest port on canvas for wire snap (Phase 17) */
export function findNearestPort(
  objects: LayoutObject[],
  canvasPoint: { x: number; y: number },
  options?: { maxDistance?: number; kind?: 'in' | 'out' },
): NearestPortHit | null {
  const maxDistance = options?.maxDistance ?? 28;
  let best: NearestPortHit | null = null;
  for (const obj of objects) {
    if (obj.visible === false) continue;
    const ports = parsePorts(obj.style?.ports);
    if (!ports.length && defaultPortsForType(obj.type)) {
      ports.push(...parsePorts(defaultPortsForType(obj.type)));
    }
    for (const port of ports) {
      if (options?.kind && port.kind !== options.kind) continue;
      const pos = portCanvasPosition(obj, port);
      const distance = Math.hypot(canvasPoint.x - pos.x, canvasPoint.y - pos.y);
      if (distance > maxDistance) continue;
      if (!best || distance < best.distance) {
        best = { objectId: obj.id, port, x: pos.x, y: pos.y, distance };
      }
    }
  }
  return best;
}

export function updateConnectedWires(objects: LayoutObject[], movedObjectId: string): LayoutObject[] {
  return objects.map((obj) => {
    if (obj.type !== 'flowpath') return obj;
    const endpoints = resolveWireEndpoints(obj.style);
    if (endpoints.fromObjectId !== movedObjectId && endpoints.toObjectId !== movedObjectId) return obj;
    if (!endpoints.fromObjectId || !endpoints.fromPortId || !endpoints.toObjectId || !endpoints.toPortId) return obj;

    const fromObj = objects.find((o) => o.id === endpoints.fromObjectId);
    const toObj = objects.find((o) => o.id === endpoints.toObjectId);
    if (!fromObj || !toObj) return obj;

    const fromPort = findPort(parsePorts(fromObj.style?.ports), endpoints.fromPortId);
    const toPort = findPort(parsePorts(toObj.style?.ports), endpoints.toPortId);
    if (!fromPort || !toPort) return obj;

    const fromPos = portCanvasPosition(fromObj, fromPort);
    const toPos = portCanvasPosition(toObj, toPort);
    const geom = pathPointsBetween(fromPos, toPos, obj.x, obj.y);

    return {
      ...obj,
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      style: { ...obj.style, pathPoints: geom.pathPoints },
    };
  });
}

export function autoGlbEquipmentPorts(): string {
  return [
    'out-top:0.5,0:Out T',
    'in-bottom:0.5,1:In B',
    'out-left:0,0.5:Out L',
    'in-right:1,0.5:In R',
    'service:0.5,0.5:Service',
  ].join(';');
}

export function createWireObject(
  fromObj: LayoutObject,
  fromPortId: string,
  toObj: LayoutObject,
  toPortId: string,
  id: string,
  name: string,
): LayoutObject {
  const fromPort = findPort(parsePorts(fromObj.style?.ports), fromPortId);
  const toPort = findPort(parsePorts(toObj.style?.ports), toPortId);
  if (!fromPort || !toPort) {
    throw new Error('Port not found');
  }
  const fromPos = portCanvasPosition(fromObj, fromPort);
  const toPos = portCanvasPosition(toObj, toPort);
  const geom = pathPointsBetween(fromPos, toPos, 0, 0);

  return {
    id,
    type: 'flowpath',
    name,
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    visible: true,
    locked: false,
    layer: Date.now(),
    style: applySceneDefaultsToStyle('flowpath', {
      pathPoints: geom.pathPoints,
      flowColor: '#22d3ee',
      idleColor: '#94a3b8',
      flowThreshold: 0.5,
      strokeWidth: 4,
      flowSpeed: 1,
      fromObjectId: fromObj.id,
      fromPortId,
      toObjectId: toObj.id,
      toPortId,
    }),
  };
}

