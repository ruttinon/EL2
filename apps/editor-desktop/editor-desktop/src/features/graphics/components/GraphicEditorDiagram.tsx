import type { MouseEvent, ReactNode } from 'react';
import type { GraphicObjectDefinition } from '@energylink/shared-types';
import type { CurrentTagValue, RuntimeAlarm } from '@energylink/graphics-runtime';
import {
  DiagramLayer,
  HudLayer,
  filterDiagramStageObjects,
  filterDiagramOnlyStageObjects,
  filterHudStageObjects,
  filterDiagramInteractionObjects,
  filterDiagramOnlyInteractionObjects,
  filterHudInteractionObjects,
} from '@energylink/unified-viewport';
import { editorRuntimeApi } from '../../../api/editorRuntimeApi';
import { EditorDiagramInteraction } from './EditorDiagramInteraction';

export type GraphicEditorDiagramProps = {
  width: number;
  height: number;
  objects: GraphicObjectDefinition[];
  is3dCamera: boolean;
  activeFloor: number | null;
  backgroundColor: string;
  backgroundImage?: string | null;
  gridEnabled: boolean;
  selectedObjectId: string | null;
  pathEditId: string | null;
  currentValues: CurrentTagValue[];
  alarms?: RuntimeAlarm[];
  emptyMessage?: string;
  onSelectObject: (id: string) => void;
  onDragStart: (event: MouseEvent<HTMLButtonElement>, object: GraphicObjectDefinition) => void;
  onResizeStart: (event: MouseEvent<HTMLDivElement>, object: GraphicObjectDefinition) => void;
  onPathChange: (objectId: string, points: Array<{ x: number; y: number }>) => void;
  children?: ReactNode;
};

export function GraphicEditorDiagram({
  width,
  height,
  objects,
  is3dCamera,
  activeFloor,
  backgroundColor,
  backgroundImage,
  gridEnabled,
  selectedObjectId,
  pathEditId,
  currentValues,
  alarms = [],
  emptyMessage = 'Drag equipment from Scene Catalog or choose a tool and click the canvas',
  onSelectObject,
  onDragStart,
  onResizeStart,
  onPathChange,
  children,
}: GraphicEditorDiagramProps) {
  const filterOpts = { is3dCamera, activeFloor };
  const splitHud = is3dCamera;
  const diagramStageObjects = splitHud
    ? filterDiagramOnlyStageObjects(objects, filterOpts)
    : filterDiagramStageObjects(objects, filterOpts);
  const hudStageObjects = splitHud ? filterHudStageObjects(objects, filterOpts) : [];
  const diagramInteractionObjects = splitHud
    ? filterDiagramOnlyInteractionObjects(objects, filterOpts)
    : filterDiagramInteractionObjects(objects, filterOpts);
  const hudInteractionObjects = splitHud ? filterHudInteractionObjects(objects, filterOpts) : [];

  const stageProps = {
    width,
    height,
    currentValues,
    alarms,
    fetchTrend: (opts: Parameters<typeof editorRuntimeApi.getTrend>[0]) =>
      editorRuntimeApi.getTrend(opts).then((r) => (r.ok ? r.data : null)),
    refreshIntervalMs: 5000,
    runtimeMode: false as const,
    animate: false,
  };

  return (
    <div className={`graphic-editor-diagram${splitHud ? ' split-hud' : ''}`} style={{ position: 'relative', width, height }}>
      {/* In 3D (Top/Orbit) the flat diagram layer is hidden — scene renders in WebGL behind.
          Only HUD floating widgets stay as a 2D overlay so SCADA data is still visible/editable. */}
      {splitHud ? null : (
        <DiagramLayer
          {...stageProps}
          objects={diagramStageObjects}
          backgroundColor={backgroundColor}
          backgroundImage={backgroundImage}
          emptyMessage={objects.length === 0 ? emptyMessage : undefined}
          stageClassName="graphic-editor-diagram-stage"
        />
      )}
      {splitHud && hudStageObjects.length > 0 ? (
        <HudLayer {...stageProps} objects={hudStageObjects} />
      ) : null}
      {splitHud ? null : (
        <EditorDiagramInteraction
          objects={diagramInteractionObjects}
          selectedObjectId={selectedObjectId}
          pathEditId={pathEditId}
          gridEnabled={gridEnabled}
          stageVisual
          className="editor-diagram-interaction"
          onSelect={onSelectObject}
          onDragStart={onDragStart}
          onResizeStart={onResizeStart}
          onPathChange={onPathChange}
        />
      )}
      {splitHud && hudInteractionObjects.length > 0 ? (
        <EditorDiagramInteraction
          objects={hudInteractionObjects}
          selectedObjectId={selectedObjectId}
          pathEditId={pathEditId}
          gridEnabled={gridEnabled}
          stageVisual
          className="editor-hud-interaction"
          onSelect={onSelectObject}
          onDragStart={onDragStart}
          onResizeStart={onResizeStart}
          onPathChange={onPathChange}
        />
      ) : null}
      {!splitHud && objects.length === 0 ? <div className="empty-canvas">{emptyMessage}</div> : null}
      {children}
    </div>
  );
}
