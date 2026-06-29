import type { GraphicAsset, GraphicObjectDefinition } from '@energylink/shared-types';
import {
  DEFAULT_BUS_PORTS,
  DEFAULT_ELEC_PORTS,
  DEFAULT_EQUIPMENT_PORTS,
  applySceneDefaultsToStyle,
  dimensionsFromRealWorld,
  DEFAULT_MM_PER_PX,
} from '@energylink/shared-types';
import {
  createWireObject,
  defaultPortsForType,
  buildRoomFromCorners,
  computeWallSegment,
  type WallSegmentGeometry,
} from '@energylink/graphics-runtime';
import type { SceneScriptEquipment, SceneScriptV1 } from './types';
import { cabinetSpecToGlbBlob, blobToDataUrl } from './proceduralGlb';

const DEFAULTS: Record<string, { w: number; h: number; d: number; symbol?: string }> = {
  mcc: { w: 800, h: 2000, d: 600 },
  panel: { w: 600, h: 1800, d: 400 },
  meter: { w: 200, h: 300, d: 150, symbol: 'meter' },
  breaker: { w: 100, h: 200, d: 80, symbol: 'breaker' },
  transformer: { w: 400, h: 500, d: 400, symbol: 'transformer' },
  motor: { w: 120, h: 120, d: 120, symbol: 'motor' },
  bus: { w: 1200, h: 40, d: 40 },
  wall: { w: 3000, h: 200, d: 100 },
};

function mmToPx(mm: number, mmPerPx: number) {
  return Math.round(mm / mmPerPx);
}

function resolveWirePort(ref: string, fallback: string): { eqId: string; portId: string } {
  const [eqId, portId] = ref.includes('.') ? ref.split('.', 2) : [ref, fallback];
  return { eqId: eqId.trim(), portId: (portId ?? fallback).trim() };
}

function baseObject(
  type: string,
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  layer: number,
  style: Record<string, unknown> = {},
): GraphicObjectDefinition {
  return {
    id,
    type,
    name,
    x,
    y,
    width,
    height,
    visible: true,
    locked: false,
    layer,
    style: applySceneDefaultsToStyle(type, style as Record<string, string | number | boolean | undefined>),
  };
}

function wallFromSegment(
  segment: WallSegmentGeometry,
  id: string,
  name: string,
  layer: number,
  wallHeight3d: number,
  color?: string,
): GraphicObjectDefinition {
  const fill = color ?? '#94a3b8';
  return baseObject('wall', id, name, segment.x, segment.y, segment.width, segment.height, layer, {
    background: fill,
    fill,
    stroke: '#64748b',
    strokeWidth: 1,
    wallHeight3d,
    wallThickness: segment.wallThickness,
    wallAngleDeg: segment.angleDeg,
    wallStartX: segment.wallStartX,
    wallStartY: segment.wallStartY,
    wallEndX: segment.wallEndX,
    wallEndY: segment.wallEndY,
    renderMode: 'scene',
  });
}

async function glbAssetFromCabinet(
  eq: SceneScriptEquipment,
  makeId: (p: string) => string,
): Promise<GraphicAsset> {
  const def = DEFAULTS[eq.kind] ?? DEFAULTS.mcc;
  const w = eq.widthMm ?? def.w;
  const h = eq.heightMm ?? def.h;
  const d = eq.depthMm ?? def.d;
  const { blob, byteLength } = await cabinetSpecToGlbBlob({
    widthMm: w,
    heightMm: h,
    depthMm: d,
    color: eq.color,
    breakerRows: eq.breakerRows,
    breakerCols: eq.breakerCols,
    name: eq.name ?? eq.id,
  });
  const dataUrl = await blobToDataUrl(blob);
  return {
    id: makeId('glb'),
    name: `${eq.name ?? eq.id}.glb`,
    kind: 'model3d',
    url: dataUrl,
    mimeType: 'model/gltf-binary',
    fileSize: byteLength,
    createdAt: new Date().toISOString(),
    realWidthMm: w,
    realHeightMm: h,
  };
}

export type BuildSceneResult = {
  objects: GraphicObjectDefinition[];
  newAssets: GraphicAsset[];
  warnings: string[];
};

export async function buildSceneFromScript(
  script: SceneScriptV1,
  makeId: (prefix: string) => string,
): Promise<BuildSceneResult> {
  const mmPerPx = script.mmPerPx ?? DEFAULT_MM_PER_PX;
  const objects: GraphicObjectDefinition[] = [];
  const newAssets: GraphicAsset[] = [];
  const warnings: string[] = [];
  const idMap = new Map<string, string>();
  let layer = 1;

  const originX = 40;
  const originY = 40;

  if (script.room) {
    const rw = mmToPx(script.room.widthMm, mmPerPx);
    const rh = mmToPx(script.room.depthMm, mmPerPx);
    const floorFill = script.room.floorColor ?? '#e2e8f0';
    const zoneLabel = script.room.label ?? 'Room';
    const wallThicknessPx = Math.max(8, mmToPx(script.room.wallThicknessMm ?? 200, mmPerPx));
    const wallHeight3d = script.room.wallHeight3d ?? 80;
    const autoWalls = script.room.walls !== false;

    if (autoWalls) {
      const corners = [
        { x: originX, y: originY },
        { x: originX + rw, y: originY },
        { x: originX + rw, y: originY + rh },
        { x: originX, y: originY + rh },
      ];
      const room = buildRoomFromCorners(corners, wallThicknessPx);

      const floor = baseObject(
        'rectangle',
        makeId('floor'),
        zoneLabel,
        room.bounds.x,
        room.bounds.y,
        room.bounds.width,
        room.bounds.height,
        layer++,
        {
          background: floorFill,
          fill: floorFill,
          stroke: '#94a3b8',
          strokeWidth: 1,
          realWidthMm: script.room.widthMm,
          realHeightMm: script.room.depthMm,
          renderMode: 'scene',
        },
      );
      objects.push(floor);

      objects.push(baseObject(
        'zone3d',
        makeId('zone'),
        zoneLabel,
        room.bounds.x,
        room.bounds.y,
        room.bounds.width,
        room.bounds.height,
        layer++,
        {
          zoneLabel,
          polygonPoints: room.polygonPoints,
          realWidthMm: script.room.widthMm,
          realHeightMm: script.room.depthMm,
          background: 'rgba(99,102,241,0.06)',
          stroke: '#6366f1',
          renderMode: 'scene',
        },
      ));

      room.walls.forEach((segment, index) => {
        objects.push(wallFromSegment(
          segment,
          makeId('wall'),
          `Wall ${index + 1}`,
          layer++,
          wallHeight3d,
        ));
      });
    } else {
      objects.push(baseObject(
        'rectangle',
        makeId('floor'),
        zoneLabel,
        originX,
        originY,
        rw,
        rh,
        layer++,
        {
          background: floorFill,
          fill: floorFill,
          realWidthMm: script.room.widthMm,
          realHeightMm: script.room.depthMm,
          renderMode: 'scene',
        },
      ));
      objects.push(baseObject(
        'zone3d',
        makeId('zone'),
        zoneLabel,
        originX,
        originY,
        rw,
        rh,
        layer++,
        {
          zoneLabel,
          realWidthMm: script.room.widthMm,
          realHeightMm: script.room.depthMm,
          background: 'rgba(99,102,241,0.06)',
          stroke: '#6366f1',
          renderMode: 'scene',
        },
      ));
    }
  }

  for (const eq of script.equipment) {
    const def = DEFAULTS[eq.kind] ?? DEFAULTS.breaker;
    const wMm = eq.widthMm ?? def.w;
    const hMm = eq.heightMm ?? def.h;
    const dims = dimensionsFromRealWorld(wMm, hMm, mmPerPx);
    const x = originX + mmToPx(eq.xMm, mmPerPx);
    const y = originY + mmToPx(eq.yMm, mmPerPx);
    const objId = makeId(eq.kind);
    idMap.set(eq.id, objId);
    const displayName = eq.name ?? eq.id;

    const useGlb = (eq.kind === 'mcc' || eq.kind === 'panel') && eq.generateGlb !== false;

    if (useGlb) {
      try {
        const asset = await glbAssetFromCabinet(eq, makeId);
        newAssets.push(asset);
        objects.push(baseObject(
          'viewport3d',
          objId,
          displayName,
          x,
          y,
          dims.width,
          dims.height,
          layer++,
          {
            sceneBuildMode: 'glb',
            glbUrl: asset.url,
            autoRotate: false,
            cameraPreset: 'isometric',
            realWidthMm: wMm,
            realHeightMm: hMm,
            boxColor: eq.color ?? '#64748b',
            ports: defaultPortsForType('viewport3d') || DEFAULT_EQUIPMENT_PORTS,
            renderMode: 'scene',
          },
        ));
      } catch (e) {
        warnings.push(`${eq.id}: GLB ไม่สำเร็จ — ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    if (eq.kind === 'bus') {
      const w = mmToPx(wMm, mmPerPx);
      const h = Math.max(12, mmToPx(hMm, mmPerPx));
      objects.push(baseObject(
        'bussection',
        objId,
        displayName,
        x,
        y,
        w,
        h,
        layer++,
        {
          pathPoints: `0,${Math.round(h / 2)};${w},${Math.round(h / 2)}`,
          ports: DEFAULT_BUS_PORTS,
          strokeWidth: 6,
          stroke: '#22d3ee',
          renderMode: 'scene',
        },
      ));
      continue;
    }

    if (eq.kind === 'wall') {
      const lenPx = mmToPx(wMm, mmPerPx);
      const thickPx = Math.max(8, mmToPx(eq.depthMm ?? def.d, mmPerPx));
      const segment = computeWallSegment(
        { x, y },
        { x: x + lenPx, y },
        thickPx,
      );
      objects.push(wallFromSegment(
        segment,
        objId,
        displayName,
        layer++,
        script.room?.wallHeight3d ?? 80,
        eq.color,
      ));
      continue;
    }

    const symbolId = eq.symbolId ?? def.symbol ?? 'breaker';
    const symObj = baseObject(
      'elecsymbol',
      objId,
      displayName,
      x,
      y,
      dims.width,
      dims.height,
      layer++,
      {
        symbolId,
        states: 'open,closed,trip',
        ports: defaultPortsForType('elecsymbol') || DEFAULT_ELEC_PORTS,
        realWidthMm: wMm,
        realHeightMm: hMm,
        renderMode: 'scene',
      },
    );
    if (eq.tagName) {
      symObj.binding = { ...symObj.binding, tagName: eq.tagName };
    }
    if (eq.navigateTo) {
      (symObj as GraphicObjectDefinition & { navigateTo?: string }).navigateTo = eq.navigateTo;
    }
    objects.push(symObj);
  }

  for (const wire of script.wires ?? []) {
    const fromRef = resolveWirePort(wire.from, wire.fromPort ?? 'out');
    const toRef = resolveWirePort(wire.to, wire.toPort ?? 'in');
    const fromObjId = idMap.get(fromRef.eqId);
    const toObjId = idMap.get(toRef.eqId);
    if (!fromObjId || !toObjId) {
      warnings.push(`wire ${wire.from}→${wire.to}: ไม่พบ equipment id`);
      continue;
    }
    const fromObj = objects.find((o) => o.id === fromObjId);
    const toObj = objects.find((o) => o.id === toObjId);
    if (!fromObj || !toObj) continue;
    try {
      const wireObj = createWireObject(
        fromObj,
        fromRef.portId,
        toObj,
        toRef.portId,
        makeId('wire'),
        `Wire ${fromRef.eqId}→${toRef.eqId}`,
      );
      objects.push({ ...wireObj, layer: layer++ } as GraphicObjectDefinition);
    } catch {
      warnings.push(`wire ${wire.from}→${wire.to}: port ไม่ตรง`);
    }
  }

  return { objects, newAssets, warnings };
}
