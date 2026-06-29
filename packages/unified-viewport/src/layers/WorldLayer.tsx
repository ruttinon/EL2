import React, { useMemo, Suspense, lazy, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, TransformControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  parsePath3dAbsolute,
  resolveR3fCameraPosition,
  computeFlowState,
  defaultBoxDepth,
  filterInlayCablesForViewport,
  cablePathInViewportHostSpace,
} from '@energylink/graphics-runtime';
import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { unifiedCameraToR3fPreset, type UnifiedCameraPreset } from '@energylink/shared-types';
import { shouldExtrudeAs3dBox } from '../extrude3d';
import { shouldRenderAsWorldSlab } from '../worldMesh';

const Spline = lazy(() => import('@splinetool/react-spline'));

type TagValueMap = Map<string, { value?: unknown }>;

function isGlbWorldObject(obj: GraphicObjectDefinition): boolean {
  if (obj.type !== 'viewport3d' && obj.type !== 'scene3d') return false;
  const glbUrl = String(obj.style?.glbUrl ?? '');
  const mode = String(obj.style?.sceneBuildMode ?? (glbUrl ? 'glb' : 'box'));
  return mode === 'glb' && glbUrl.length > 0;
}

function isSplineWorldObject(obj: GraphicObjectDefinition): boolean {
  return obj.type === 'viewport3d' && String(obj.style?.sceneBuildMode) === 'spline';
}

export type WorldLayerProps = {
  objects: GraphicObjectDefinition[];
  width: number;
  height: number;
  cameraPreset: UnifiedCameraPreset;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onUpdateObject?: (id: string, updates: Partial<GraphicObjectDefinition>) => void;
  eventSource?: React.RefObject<HTMLElement | null>;
  valuesByTag?: TagValueMap;
  zonePaintEnabled?: boolean;
  onZonePaint?: (x: number, y: number) => void;
  floorClickEnabled?: boolean;
  onFloorClick?: (x: number, y: number) => void;
  orbitEnabled?: boolean;
};

function ThreeBox({
  object,
  isSelected,
  onSelect,
  onUpdate,
  valuesByTag,
  peerObjects = [],
}: {
  object: GraphicObjectDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  valuesByTag?: TagValueMap;
  peerObjects?: GraphicObjectDefinition[];
}) {
  const boxDepth = defaultBoxDepth(object.width, object.height, object.style as Record<string, unknown>);
  const sideColor = String(object.style?.background ?? '#475569');
  const depthZ = Number(object.style?.depthZ ?? 0);
  const posX = object.x + object.width / 2;
  const posY = -(object.y + object.height / 2);
  const posZ = depthZ + boxDepth / 2;
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef(0);
  const rotate3dTagId = object.binding?.rotate3dTagId as string | undefined;
  const rotate3dAxis = (object.binding?.rotate3dAxis as 'x' | 'y' | 'z') ?? 'y';
  const rotate3dMultiplier = Number(object.binding?.rotate3dMultiplier ?? 1);

  useEffect(() => {
    if (!rotate3dTagId || !valuesByTag) return;
    const val = valuesByTag.get(rotate3dTagId)?.value;
    if (val != null) targetRotation.current = (Number(val) * rotate3dMultiplier * Math.PI) / 180;
  }, [valuesByTag, rotate3dTagId, rotate3dMultiplier]);

  useFrame(() => {
    if (!groupRef.current || !rotate3dTagId) return;
    groupRef.current.rotation[rotate3dAxis] = THREE.MathUtils.lerp(
      groupRef.current.rotation[rotate3dAxis],
      targetRotation.current,
      0.08,
    );
  });

  return (
    <group ref={groupRef} position={[posX, posY, posZ]}>
      {isSelected ? (
        <TransformControls
          mode="translate"
          onObjectChange={(e: unknown) => {
            const target = (e as { target?: { object?: THREE.Object3D } })?.target?.object;
            if (target) {
              onUpdate(object.id, {
                x: target.position.x - object.width / 2,
                y: -target.position.y - object.height / 2,
                style: { ...object.style, depthZ: target.position.z - boxDepth / 2 },
              });
            }
          }}
        >
          <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <boxGeometry args={[object.width, object.height, boxDepth]} />
            <meshStandardMaterial color={sideColor} />
          </mesh>
        </TransformControls>
      ) : (
        <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[object.width, object.height, boxDepth]} />
          <meshStandardMaterial color={sideColor} />
        </mesh>
      )}
      <ThreeViewportCableGroup host={object} peerObjects={peerObjects} valuesByTag={valuesByTag} />
    </group>
  );
}

function ThreeSceneSlab({
  object,
  isSelected,
  onSelect,
}: {
  object: GraphicObjectDefinition;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isFloor = object.type === 'rectangle' || object.type === 'panel' || object.type === 'image';
  const boxDepth = isFloor
    ? Math.max(4, Number(object.style?.slabDepth ?? 10))
    : Math.max(12, Math.min(object.width, object.height, 48));
  const sideColor = String(object.style?.fill ?? object.style?.background ?? '#94a3b8');
  const depthZ = Number(object.style?.depthZ ?? 0);
  const posX = object.x + object.width / 2;
  const posY = -(object.y + object.height / 2);
  const posZ = depthZ + boxDepth / 2;

  return (
    <group position={[posX, posY, posZ]}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[object.width, object.height, boxDepth]} />
        <meshStandardMaterial
          color={isSelected ? '#a5b4fc' : sideColor}
          opacity={isFloor ? 0.92 : 0.95}
          transparent
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

function ThreeWall({
  object,
  isSelected,
  onSelect,
}: {
  object: GraphicObjectDefinition;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const sx = Number(object.style?.wallStartX ?? object.x);
  const sy = Number(object.style?.wallStartY ?? object.y);
  const ex = Number(object.style?.wallEndX ?? object.x + object.width);
  const ey = Number(object.style?.wallEndY ?? object.y);
  const wallH3d = Number(object.style?.wallHeight3d ?? 80);
  const wallThick = Number(object.style?.wallThickness ?? 16);
  const wallColor = String(object.style?.fill ?? '#94a3b8');
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const angle = Math.atan2(dy, dx);
  const midX = (sx + ex) / 2;
  const midY = -((sy + ey) / 2);
  const midZ = wallH3d / 2;
  const wallGeo = useMemo(() => new THREE.BoxGeometry(len, wallThick, wallH3d), [len, wallThick, wallH3d]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(wallGeo), [wallGeo]);

  return (
    <group position={[midX, midY, midZ]} rotation={[0, 0, -angle]}>
      <mesh geometry={wallGeo} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <meshStandardMaterial
          color={isSelected ? '#a5b4fc' : wallColor}
          opacity={isSelected ? 0.9 : 0.95}
          transparent
          roughness={0.75}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color={isSelected ? '#c7d2fe' : '#475569'} />
      </lineSegments>
    </group>
  );
}

function ThreeViewportCable({
  cable,
  host,
  valuesByTag,
}: {
  cable: GraphicObjectDefinition;
  host: GraphicObjectDefinition;
  valuesByTag?: TagValueMap;
}) {
  const flowColor = String(cable.style?.flowColor ?? '#a78bfa');
  const idleColor = String(cable.style?.idleColor ?? '#64748b');
  const radius = Number(cable.style?.cableRadius ?? cable.style?.strokeWidth ?? 3);
  const flowTagId = cable.binding?.flowTagId ?? cable.binding?.tagId;
  const enableTagId = cable.binding?.enableTagId;
  const flowRaw = flowTagId && valuesByTag ? valuesByTag.get(flowTagId)?.value : undefined;
  const enableRaw = enableTagId && valuesByTag ? valuesByTag.get(enableTagId)?.value : undefined;
  const { flowing, reverse } = computeFlowState({
    flowRaw,
    enableRaw,
    threshold: Number(cable.style?.flowThreshold ?? 0.5),
    requireEnable: cable.style?.requireEnable !== false && !!enableTagId,
  });
  const particleRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);
  const curve = useMemo(() => {
    const pts = cablePathInViewportHostSpace(cable, host);
    if (pts.length < 2) return null;
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
  }, [cable, host]);

  useFrame((_, delta) => {
    if (!particleRef.current || !curve) return;
    if (!flowing || cable.style?.cableParticles === false) {
      particleRef.current.visible = false;
      return;
    }
    particleRef.current.visible = true;
    const step = delta * Number(cable.style?.flowSpeed ?? 1) * 0.35 * (reverse ? -1 : 1);
    tRef.current = ((tRef.current + step) % 1 + 1) % 1;
    particleRef.current.position.copy(curve.getPoint(tRef.current));
  });

  if (!curve) return null;
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 48, radius * 0.35, 6, false]} />
        <meshStandardMaterial
          color={idleColor}
          emissive={flowing ? flowColor : '#000000'}
          emissiveIntensity={flowing ? 0.45 : 0.05}
        />
      </mesh>
      <mesh ref={particleRef} visible={flowing}>
        <sphereGeometry args={[radius * 0.5, 10, 10]} />
        <meshStandardMaterial color={flowColor} emissive={flowColor} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function ThreeViewportCableGroup({
  host,
  peerObjects,
  valuesByTag,
}: {
  host: GraphicObjectDefinition;
  peerObjects: GraphicObjectDefinition[];
  valuesByTag?: TagValueMap;
}) {
  const cables = useMemo(() => {
    if (host.style?.viewportCableInlay === false) return [];
    return filterInlayCablesForViewport(host as never, peerObjects as never);
  }, [host, peerObjects]);
  if (cables.length === 0) return null;
  return (
    <>
      {cables.map((cable) => (
        <ThreeViewportCable key={cable.id} cable={cable} host={host} valuesByTag={valuesByTag} />
      ))}
    </>
  );
}

function ThreeCable({ object, valuesByTag }: { object: GraphicObjectDefinition; valuesByTag?: TagValueMap }) {
  const flowColor = String(object.style?.flowColor ?? (object.type === 'pipe' ? '#22d3ee' : '#a78bfa'));
  const idleColor = String(object.style?.idleColor ?? (object.type === 'pipe' ? '#0e7490' : '#64748b'));
  const radius =
    Number(object.style?.cableRadius ?? object.style?.strokeWidth ?? object.style?.pipeWidth ?? 3) *
    (object.type === 'flowpath' ? 0.35 : object.type === 'pipe' ? 0.55 : 1);
  const flowTagId = object.binding?.flowTagId ?? object.binding?.tagId;
  const enableTagId = object.binding?.enableTagId;
  const flowRaw = flowTagId && valuesByTag ? valuesByTag.get(flowTagId)?.value : undefined;
  const enableRaw = enableTagId && valuesByTag ? valuesByTag.get(enableTagId)?.value : undefined;
  const { flowing, reverse } = computeFlowState({
    flowRaw,
    enableRaw,
    threshold: Number(object.style?.flowThreshold ?? 0.5),
    requireEnable: object.style?.requireEnable !== false && !!enableTagId,
  });
  const particleRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);
  const curve = useMemo(() => {
    const raw3d = parsePath3dAbsolute(object.style?.path3d);
    const pts =
      raw3d.length >= 2
        ? raw3d
        : String(object.style?.pathPoints ?? '')
            .split(';')
            .map((part) => {
              const [xs, ys] = part.split(',').map((s) => s.trim());
              return { x: Number(xs) + object.x, y: Number(ys) + object.y, z: 0 };
            })
            .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pts.length < 2) return null;
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, -p.y, p.z ?? 0)));
  }, [object]);

  useFrame((_, delta) => {
    if (!particleRef.current || !curve) return;
    if (!flowing) {
      particleRef.current.visible = false;
      return;
    }
    particleRef.current.visible = true;
    const step = delta * Number(object.style?.flowSpeed ?? 1) * 0.35 * (reverse ? -1 : 1);
    tRef.current = ((tRef.current + step) % 1 + 1) % 1;
    particleRef.current.position.copy(curve.getPoint(tRef.current));
  });

  if (!curve) return null;
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 48, radius, 6, false]} />
        <meshStandardMaterial
          color={idleColor}
          emissive={flowing ? flowColor : '#000000'}
          emissiveIntensity={flowing ? 0.45 : 0.05}
        />
      </mesh>
      <mesh ref={particleRef} visible={flowing}>
        <sphereGeometry args={[radius * 1.4, 10, 10]} />
        <meshStandardMaterial color={flowColor} emissive={flowColor} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function ThreeZone({
  object,
  isSelected,
  onSelect,
}: {
  object: GraphicObjectDefinition;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const extrudeH = Number(object.style?.zoneExtrudeHeight ?? object.style?.wallHeight3d ?? 40);
  const depthZ = Number(object.style?.depthZ ?? 0);
  const fill = String(object.style?.fill ?? object.style?.background ?? '#6366f1');
  return (
    <mesh
      position={[object.x + object.width / 2, -(object.y + object.height / 2), depthZ + extrudeH / 2]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <boxGeometry args={[object.width, object.height, extrudeH]} />
      <meshStandardMaterial color={fill} transparent opacity={isSelected ? 0.35 : 0.2} />
    </mesh>
  );
}

function ThreeGlb({
  object,
  isSelected,
  onSelect,
  onUpdate,
  peerObjects = [],
  valuesByTag,
}: {
  object: GraphicObjectDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  peerObjects?: GraphicObjectDefinition[];
  valuesByTag?: TagValueMap;
}) {
  const glbUrl = String(object.style?.glbUrl ?? '');
  const { scene } = useGLTF(glbUrl);
  const model = useMemo(() => scene.clone(true), [scene]);
  const depthZ = Number(object.style?.depthZ ?? 0);
  const posX = object.x + object.width / 2;
  const posY = -(object.y + object.height / 2);
  const posZ = depthZ;
  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const sx = size.x > 0 ? object.width / size.x : 1;
    const sy = size.y > 0 ? object.height / size.y : 1;
    const s = Math.min(sx, sy);
    return [s, s, s] as [number, number, number];
  }, [model, object.width, object.height]);

  const mesh = (
    <primitive
      object={model}
      scale={scale}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect();
      }}
    />
  );

  return (
    <group position={[posX, posY, posZ]}>
      {isSelected ? (
        <TransformControls
          mode="translate"
          onObjectChange={(e: unknown) => {
            const target = (e as { target?: { object?: THREE.Object3D } })?.target?.object;
            if (target) {
              onUpdate(object.id, {
                x: target.position.x - object.width / 2,
                y: -target.position.y - object.height / 2,
                style: { ...object.style, depthZ: target.position.z },
              });
            }
          }}
        >
          {mesh}
        </TransformControls>
      ) : (
        mesh
      )}
      <ThreeViewportCableGroup host={object} peerObjects={peerObjects} valuesByTag={valuesByTag} />
    </group>
  );
}

function ThreeSpline({
  object,
  isSelected,
  onSelect,
  onUpdate,
  valuesByTag,
}: {
  object: GraphicObjectDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  valuesByTag?: TagValueMap;
}) {
  const splineUrl = String(object.style?.splineUrl ?? '');
  const splineAppRef = useRef<{ setVariable: (name: string, value: number) => void } | null>(null);

  useEffect(() => {
    const app = splineAppRef.current;
    if (!app || !valuesByTag || !object.binding?.splineMappings) return;
    Object.entries(object.binding.splineMappings as Record<string, string>).forEach(([varName, tagId]) => {
      const val = valuesByTag.get(tagId)?.value;
      if (val != null) app.setVariable(varName, Number(val));
    });
  }, [valuesByTag, object.binding?.splineMappings]);

  if (!splineUrl) return null;

  const depthZ = Number(object.style?.depthZ ?? 0);
  const posX = object.x + object.width / 2;
  const posY = -(object.y + object.height / 2);
  const posZ = depthZ + 10;

  return (
    <group position={[posX, posY, posZ]}>
      {isSelected ? (
        <TransformControls
          mode="translate"
          onObjectChange={(e: unknown) => {
            const target = (e as { target?: { object?: THREE.Object3D } })?.target?.object;
            if (target) {
              onUpdate(object.id, {
                x: target.position.x - object.width / 2,
                y: -target.position.y - object.height / 2,
                style: { ...object.style, depthZ: target.position.z - 10 },
              });
            }
          }}
        >
          <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }} visible={false}>
            <boxGeometry args={[object.width, object.height, 20]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </TransformControls>
      ) : (
        <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }} visible={false}>
          <boxGeometry args={[object.width, object.height, 20]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      <Html
        transform
        occlude
        position={[0, 0, 0]}
        style={{
          width: `${object.width}px`,
          height: `${object.height}px`,
          pointerEvents: isSelected ? 'none' : 'auto',
          border: isSelected ? '2px solid #a5b4fc' : 'none',
          boxSizing: 'border-box',
        }}
      >
        <Suspense
          fallback={(
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', color: '#475569', fontSize: 12 }}>
              Loading Spline...
            </div>
          )}
        >
          <Spline
            scene={splineUrl}
            style={{ width: '100%', height: '100%' }}
            onLoad={(spline) => {
              splineAppRef.current = spline;
              if (valuesByTag && object.binding?.splineMappings) {
                Object.entries(object.binding.splineMappings as Record<string, string>).forEach(([varName, tagId]) => {
                  const val = valuesByTag.get(tagId)?.value;
                  if (val != null) spline.setVariable(varName, Number(val));
                });
              }
            }}
          />
        </Suspense>
      </Html>
    </group>
  );
}

function FloorInteractionPlane({
  width,
  height,
  enabled,
  onPoint,
}: {
  width: number;
  height: number;
  enabled?: boolean;
  onPoint?: (x: number, y: number) => void;
}) {
  if (!enabled || !onPoint) return null;
  return (
    <mesh
      position={[width / 2, -height / 2, 0.5]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const p = e.intersections[0]?.point ?? e.point;
        if (!p) return;
        onPoint(Math.round(p.x), Math.round(-p.y));
      }}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
    </mesh>
  );
}

function R3fCameraSetup({
  width,
  height,
  preset,
}: {
  width: number;
  height: number;
  preset: string;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const [x, y, z] = resolveR3fCameraPosition(width, height, preset);
    camera.position.set(x, y, z);
    camera.lookAt(width / 2, -height / 2, 40);
    camera.updateProjectionMatrix();
  }, [camera, width, height, preset]);
  return null;
}

export function WorldLayer({
  objects,
  width,
  height,
  cameraPreset,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  eventSource,
  valuesByTag,
  zonePaintEnabled,
  onZonePaint,
  floorClickEnabled,
  onFloorClick,
  orbitEnabled = true,
}: WorldLayerProps) {
  const r3fPreset = unifiedCameraToR3fPreset(cameraPreset);
  const threeBoxObjects = useMemo(() => objects.filter(shouldExtrudeAs3dBox), [objects]);
  const slabObjects = useMemo(() => objects.filter(shouldRenderAsWorldSlab), [objects]);
  const wallObjects = useMemo(() => objects.filter((o) => o.type === 'wall'), [objects]);
  const cableObjects = useMemo(
    () =>
      objects.filter(
        (o) =>
          (o.type === 'cable3d' || o.type === 'flowpath' || o.type === 'pipe') &&
          o.visible !== false &&
          !o.style?.viewportHostId,
      ),
    [objects],
  );
  const zoneObjects = useMemo(() => objects.filter((o) => o.type === 'zone3d' && o.visible !== false), [objects]);
  const glbObjects = useMemo(() => objects.filter(isGlbWorldObject), [objects]);
  const splineObjects = useMemo(() => objects.filter(isSplineWorldObject), [objects]);

  const floorHandler = zonePaintEnabled ? onZonePaint : floorClickEnabled ? onFloorClick : undefined;
  const floorEnabled = Boolean(zonePaintEnabled || floorClickEnabled);
  const hasSceneContent =
    threeBoxObjects.length > 0 ||
    slabObjects.length > 0 ||
    wallObjects.length > 0 ||
    zoneObjects.length > 0 ||
    cableObjects.length > 0 ||
    glbObjects.length > 0 ||
    splineObjects.length > 0;

  return (
    <div className="uv-world-layer" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      <Canvas
        orthographic
        camera={{ position: resolveR3fCameraPosition(width, height, r3fPreset), zoom: 1 }}
        eventSource={eventSource as React.RefObject<HTMLElement> | undefined as never}
        eventPrefix="client"
        style={{ width, height, touchAction: 'none' }}
      >
        <R3fCameraSetup width={width} height={height} preset={r3fPreset} />
        <ambientLight intensity={0.75} />
        <hemisphereLight color="#ffffff" groundColor="#b9c6d2" intensity={0.6} />
        <directionalLight position={[width / 2, -200, 600]} intensity={1.2} />
        <directionalLight position={[-200, -height, 300]} intensity={0.4} />
        {orbitEnabled ? <OrbitControls makeDefault target={[width / 2, -height / 2, 40]} /> : null}
        {!hasSceneContent ? (
          <Html position={[width / 2, -height / 2, 60]} center>
            <div className="uv-world-empty-hint">
              <b>3D Scene ว่าง</b>
              <span>วาง Room prefab / Wall / 3D Box จากแถบล่าง · ลากหมุนมุมมอง</span>
            </div>
          </Html>
        ) : null}
        <FloorInteractionPlane width={width} height={height} enabled={floorEnabled} onPoint={floorHandler} />
        {threeBoxObjects.map((obj) => (
          <ThreeBox
            key={obj.id}
            object={obj}
            isSelected={obj.id === selectedObjectId}
            onSelect={() => onSelectObject?.(obj.id)}
            onUpdate={(id, patch) => onUpdateObject?.(id, patch)}
            valuesByTag={valuesByTag}
            peerObjects={objects}
          />
        ))}
        {slabObjects.map((obj) => (
          <ThreeSceneSlab
            key={obj.id}
            object={obj}
            isSelected={obj.id === selectedObjectId}
            onSelect={() => onSelectObject?.(obj.id)}
          />
        ))}
        {wallObjects.map((obj) => (
          <ThreeWall
            key={obj.id}
            object={obj}
            isSelected={obj.id === selectedObjectId}
            onSelect={() => onSelectObject?.(obj.id)}
          />
        ))}
        {zoneObjects.map((obj) => (
          <ThreeZone
            key={obj.id}
            object={obj}
            isSelected={obj.id === selectedObjectId}
            onSelect={() => onSelectObject?.(obj.id)}
          />
        ))}
        {cableObjects.map((obj) => (
          <ThreeCable key={obj.id} object={obj} valuesByTag={valuesByTag} />
        ))}
        {glbObjects.map((obj) => (
          <Suspense key={obj.id} fallback={null}>
            <ThreeGlb
              object={obj}
              isSelected={obj.id === selectedObjectId}
              onSelect={() => onSelectObject?.(obj.id)}
              onUpdate={(id, patch) => onUpdateObject?.(id, patch)}
              peerObjects={objects}
              valuesByTag={valuesByTag}
            />
          </Suspense>
        ))}
        {splineObjects.map((obj) => (
          <ThreeSpline
            key={obj.id}
            object={obj}
            isSelected={obj.id === selectedObjectId}
            onSelect={() => onSelectObject?.(obj.id)}
            onUpdate={(id, patch) => onUpdateObject?.(id, patch)}
            valuesByTag={valuesByTag}
          />
        ))}
      </Canvas>
    </div>
  );
}
