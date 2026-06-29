import React, { useMemo } from 'react';
import type { GraphicObjectDefinition, GraphicLayout } from '@energylink/shared-types';
import {
  shouldMountWorldLayer,
  type UnifiedCameraPreset,
} from '@energylink/shared-types';
import { GraphicStage, type GraphicStageProps } from '@energylink/graphics-runtime';
import { splitObjectsByUnifiedLayer } from './migrate/layoutV1ToV2';
import { shouldRenderAsWorldSlab } from './worldMesh';
import { WorldLayer } from './layers/WorldLayer';
import './unified-viewport.css';

export type UnifiedViewportEditorProps = {
  mode: 'editor';
  width: number;
  height: number;
  cameraPreset: UnifiedCameraPreset;
  objects: GraphicObjectDefinition[];
  backgroundColor?: string;
  backgroundImage?: string | null;
  children: React.ReactNode;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string) => void;
  onUpdateObject?: (id: string, updates: Partial<GraphicObjectDefinition>) => void;
  eventSource?: React.RefObject<HTMLElement | null>;
  valuesByTag?: Map<string, { value?: unknown }>;
  zonePaintEnabled?: boolean;
  onZonePaint?: (x: number, y: number) => void;
  floorClickEnabled?: boolean;
  onFloorClick?: (x: number, y: number) => void;
  canvasZoom?: number;
  diagramPointerActive?: boolean;
  className?: string;
};

export type UnifiedViewportRuntimeProps = {
  mode: 'runtime';
  width: number;
  height: number;
  cameraPreset?: UnifiedCameraPreset;
  layout?: GraphicLayout;
  objects: GraphicObjectDefinition[];
  stageProps: Omit<GraphicStageProps, 'width' | 'height' | 'objects' | 'backgroundColor' | 'backgroundImage'>;
  backgroundColor?: string;
  backgroundImage?: string | null;
  activeFloor?: number | null;
  className?: string;
};

export type UnifiedViewportProps = UnifiedViewportEditorProps | UnifiedViewportRuntimeProps;

export function UnifiedViewport(props: UnifiedViewportProps) {
  const camera =
    props.mode === 'runtime'
      ? props.cameraPreset ?? props.layout?.defaultCamera ?? 'flat'
      : props.cameraPreset;

  const { world, diagram, hud, flat } = useMemo(() => splitObjectsByUnifiedLayer(props.objects), [props.objects]);
  const is3dCamera = camera === 'top' || camera === 'orbit';
  const worldLayerObjects = useMemo(() => {
    if (props.mode !== 'editor' || !is3dCamera) return world;
    const extra = props.objects.filter((o) => shouldRenderAsWorldSlab(o));
    const ids = new Set(world.map((o) => o.id));
    return [...world, ...extra.filter((o) => !ids.has(o.id))];
  }, [world, props.objects, props.mode, is3dCamera]);
  const showWorld =
    props.mode === 'editor'
      ? is3dCamera
      : shouldMountWorldLayer(camera, world.length > 0);
  const splitHudTier = is3dCamera && showWorld && hud.length > 0;
  const zoom = props.mode === 'editor' ? (props.canvasZoom ?? 1) : 1;
  const diagramActive =
    props.mode === 'editor' ? !is3dCamera || Boolean(props.diagramPointerActive) : true;

  return (
    <div
      className={`unified-viewport${is3dCamera ? ' uv-3d-camera' : ' uv-flat-camera'}${diagramActive && is3dCamera ? ' uv-diagram-tools-active' : ''}${props.className ? ` ${props.className}` : ''}`}
      style={{ position: 'relative', width: props.width, height: props.height, overflow: 'hidden' }}
    >
      <div
        className="unified-viewport-inner"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: props.width,
          height: props.height,
          position: 'relative',
          backgroundColor: is3dCamera ? '#1e293b' : (props.backgroundColor ?? '#fbfdff'),
        }}
      >
        {showWorld ? (
          <WorldLayer
            objects={worldLayerObjects}
            width={props.width}
            height={props.height}
            cameraPreset={camera}
            selectedObjectId={props.mode === 'editor' ? props.selectedObjectId : undefined}
            onSelectObject={props.mode === 'editor' ? props.onSelectObject : undefined}
            onUpdateObject={props.mode === 'editor' ? props.onUpdateObject : undefined}
            eventSource={
              props.mode === 'editor' && is3dCamera && !props.diagramPointerActive
                ? undefined
                : (props.mode === 'editor' ? props.eventSource : undefined)
            }
            valuesByTag={props.mode === 'editor' ? props.valuesByTag : props.mode === 'runtime' ? buildTagMap(props.stageProps.currentValues) : undefined}
            zonePaintEnabled={props.mode === 'editor' ? props.zonePaintEnabled : false}
            onZonePaint={props.mode === 'editor' ? props.onZonePaint : undefined}
            floorClickEnabled={props.mode === 'editor' ? props.floorClickEnabled : false}
            onFloorClick={props.mode === 'editor' ? props.onFloorClick : undefined}
            orbitEnabled={is3dCamera}
          />
        ) : null}

        {props.mode === 'editor' ? (
          <div
            className="uv-diagram-layer"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              pointerEvents: diagramActive ? 'auto' : 'none',
            }}
          >
            <div
              className="uv-diagram-layer-inner"
              style={{ pointerEvents: diagramActive ? 'auto' : 'none', width: '100%', height: '100%' }}
            >
              {props.children}
            </div>
          </div>
        ) : (
          <>
            <div
              className="uv-runtime-stage uv-runtime-diagram"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                pointerEvents: 'auto',
                background: showWorld && is3dCamera ? 'transparent' : undefined,
              }}
            >
              <GraphicStage
                width={props.width}
                height={props.height}
                backgroundColor={showWorld && is3dCamera ? 'transparent' : (props.backgroundColor ?? '#fbfdff')}
                backgroundImage={!is3dCamera ? props.backgroundImage : null}
                objects={splitHudTier ? diagram : flat}
                {...props.stageProps}
                activeFloor={props.activeFloor ?? props.stageProps.activeFloor}
              />
            </div>
            {splitHudTier ? (
              <div
                className="uv-runtime-stage uv-runtime-hud"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 3,
                  pointerEvents: 'auto',
                }}
              >
                <GraphicStage
                  width={props.width}
                  height={props.height}
                  backgroundColor="transparent"
                  backgroundImage={null}
                  objects={hud}
                  {...props.stageProps}
                  activeFloor={props.activeFloor ?? props.stageProps.activeFloor}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function buildTagMap(values: GraphicStageProps['currentValues']) {
  return new Map(values.map((v) => [v.id, v]));
}

export { CameraToolbar } from './camera/CameraToolbar';
export { normalizeGraphicLayout, splitObjectsByUnifiedLayer, layoutV1ToV2 } from './migrate/layoutV1ToV2';
