import type { MouseEvent } from 'react';
import type { GraphicObjectDefinition } from '@energylink/shared-types';
import {
  EditorFlowPathEditor,
  parsePathPoints,
  resolveRenderMode,
  isChromelessRenderMode,
} from '@energylink/graphics-runtime';
import { shouldExtrudeAs3dBox } from '../imageHelpers';

const GRID_SIZE = 20;

type ExtendedObject = GraphicObjectDefinition & {
  tagIds?: string[];
};

export type EditorDiagramInteractionProps = {
  objects: GraphicObjectDefinition[];
  selectedObjectId: string | null;
  pathEditId: string | null;
  gridEnabled: boolean;
  stageVisual: boolean;
  className?: string;
  onSelect: (id: string) => void;
  onDragStart: (event: MouseEvent<HTMLButtonElement>, object: GraphicObjectDefinition) => void;
  onResizeStart: (event: MouseEvent<HTMLDivElement>, object: GraphicObjectDefinition) => void;
  onPathChange: (objectId: string, points: Array<{ x: number; y: number }>) => void;
};

export function EditorDiagramInteraction({
  objects,
  selectedObjectId,
  pathEditId,
  gridEnabled,
  stageVisual,
  className = 'editor-diagram-interaction',
  onSelect,
  onDragStart,
  onResizeStart,
  onPathChange,
}: EditorDiagramInteractionProps) {
  const sorted = [...objects]
    .sort((a, b) => {
      const za = Number(a.style?.depthZ ?? a.layer ?? 0);
      const zb = Number(b.style?.depthZ ?? b.layer ?? 0);
      return za - zb;
    })
    .filter((object) => object.visible !== false);

  return (
    <div className={className}>
      {sorted.map((object) => {
        if (object.type === 'wall') {
          const sx = Number(object.style?.wallStartX ?? object.x);
          const sy = Number(object.style?.wallStartY ?? object.y);
          const ex = Number(object.style?.wallEndX ?? object.x + object.width);
          const ey = Number(object.style?.wallEndY ?? object.y);
          const thick = Number(object.style?.wallThickness ?? 16);
          const len = Math.max(20, Math.round(Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)));
          const angle = Math.atan2(ey - sy, ex - sx);
          const isSelected = object.id === selectedObjectId;
          return (
            <button
              key={object.id}
              type="button"
              className={`graphic-object graphic-object-wall${isSelected ? ' selected' : ''}`}
              style={{
                position: 'absolute',
                left: sx,
                top: sy - thick / 2,
                width: len,
                height: thick,
                transform: `rotate(${angle}rad)`,
                transformOrigin: `0 ${thick / 2}px`,
                background: String(object.style?.fill ?? '#94a3b8'),
                border: isSelected ? '2px solid #6366f1' : '1px solid #64748b',
                borderRadius: 2,
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: object.layer ?? 1,
              }}
              title={`Wall · ${len}px · ${Math.round((angle * 180) / Math.PI)}°`}
              onMouseDown={(e) => onDragStart(e, object)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(object.id);
              }}
            />
          );
        }

        const extrude3d = shouldExtrudeAs3dBox(object);
        const depthZ = Number(object.style?.depthZ ?? 0);
        const isPathWire = object.type === 'flowpath' || object.type === 'cable3d' || object.type === 'pipe';
        const pathPts = isPathWire
          ? parsePathPoints(object.style?.pathPoints as string | undefined, object.width, object.height)
          : [];
        const renderMode = resolveRenderMode(object);
        const chromeless = isChromelessRenderMode(renderMode) || isPathWire;
        const isSceneBackdrop = object.type === 'scene3d';
        const passThroughBackdrop = isSceneBackdrop && object.id !== selectedObjectId;
        const ext = object as ExtendedObject;
        const needsTag = ['value', 'gauge', 'alarm', 'led', 'levelbar', 'multistate', 'switch', 'slider', 'sparkline', 'hotspot', 'elecsymbol', 'statusbadge'].includes(object.type);
        const needsMultiTag = ['trend', 'formulavalue'].includes(object.type);
        const needsFlow = isPathWire;
        const hasMultiTags = Boolean(ext.tagIds?.length || object.binding?.tagIds?.length);
        const unbound = (needsTag && !object.binding?.tagId)
          || (needsMultiTag && !object.binding?.tagId && !hasMultiTags)
          || (needsFlow && !object.binding?.flowTagId && !object.binding?.tagId);
        const isSelected = object.id === selectedObjectId;

        if (stageVisual) {
          return (
            <button
              key={object.id}
              type="button"
              className={`graphic-object graphic-object-hit graphic-object-${object.type}${isSelected ? ' selected' : ''}${unbound ? ' unbound' : ''}${pathEditId === object.id ? ' path-editing' : ''}${isSceneBackdrop ? ' scene3d-backdrop' : ''}`}
              style={{
                position: 'absolute',
                left: object.x,
                top: object.y,
                width: object.width,
                height: object.height,
                background: 'transparent',
                border: isSelected ? '2px solid #6366f1' : unbound ? '1px dashed #f59e0b' : '1px solid transparent',
                boxShadow: 'none',
                zIndex: isSceneBackdrop ? 0 : (object.layer ?? 1) + Math.round(depthZ),
                opacity: object.locked ? 0.85 : 1,
                padding: 0,
                overflow: isPathWire ? 'visible' : 'hidden',
                pointerEvents: passThroughBackdrop ? 'none' : 'auto',
                cursor: object.locked ? 'not-allowed' : 'pointer',
              }}
              onMouseDown={(e) => onDragStart(e, object)}
              onClick={(e) => {
                if (passThroughBackdrop) return;
                e.stopPropagation();
                onSelect(object.id);
              }}
              title={object.locked ? 'Locked object' : object.name || object.type}
            >
              {isPathWire && isSelected ? (
                <EditorFlowPathEditor
                  points={pathPts}
                  width={object.width}
                  height={object.height}
                  editable
                  gridSnap={gridEnabled ? GRID_SIZE : 0}
                  strokeColor={object.type === 'cable3d' ? '#a78bfa' : object.type === 'pipe' ? '#06b6d4' : undefined}
                  strokeWidth={object.type === 'cable3d' ? 6 : object.type === 'pipe' ? Number(object.style?.pipeWidth ?? 14) : undefined}
                  onChange={(pts) => onPathChange(object.id, pts)}
                />
              ) : null}
              {isSelected && !object.locked && !isPathWire ? (
                <div
                  className="editor-resize-handle"
                  role="presentation"
                  onMouseDown={(e) => onResizeStart(e, object)}
                />
              ) : null}
            </button>
          );
        }

        return (
          <button
            key={object.id}
            type="button"
            className={`graphic-object graphic-object-${object.type} render-${renderMode}${chromeless ? ' chromeless' : ''} ${isSelected ? 'selected' : ''}${unbound ? ' unbound' : ''}${pathEditId === object.id ? ' path-editing' : ''}${isSceneBackdrop ? ' scene3d-backdrop' : ''}`}
            style={{
              position: 'absolute',
              left: object.x,
              top: object.y,
              width: object.width,
              height: object.height,
              color: String(object.style?.color ?? '#142033'),
              background: chromeless ? 'transparent' : String(object.style?.background ?? '#ffffff'),
              border: chromeless ? 'none' : undefined,
              boxShadow: chromeless ? 'none' : undefined,
              borderColor: chromeless ? 'transparent' : String(object.style?.stroke ?? '#9fc4cc'),
              fontSize: Number(object.style?.fontSize ?? 16),
              zIndex: isSceneBackdrop ? 0 : (object.layer ?? 1) + Math.round(depthZ),
              opacity: object.locked ? 0.7 : 1,
              padding: chromeless || isPathWire ? 0 : undefined,
              overflow: extrude3d || isPathWire ? 'visible' : 'hidden',
              pointerEvents: passThroughBackdrop ? 'none' : undefined,
            }}
            onMouseDown={(e) => onDragStart(e, object)}
            onClick={(e) => {
              if (passThroughBackdrop) return;
              e.stopPropagation();
              onSelect(object.id);
            }}
            title={isSceneBackdrop ? 'Full 3D background — select from Layers panel' : object.locked ? 'Locked object' : isPathWire ? `${object.type} — edit points in properties` : 'Click and drag to move'}
          >
            {isPathWire ? (
              <EditorFlowPathEditor
                points={pathPts}
                width={object.width}
                height={object.height}
                editable={isSelected}
                gridSnap={gridEnabled ? GRID_SIZE : 0}
                strokeColor={object.type === 'cable3d' ? '#a78bfa' : object.type === 'pipe' ? '#06b6d4' : undefined}
                strokeWidth={object.type === 'cable3d' ? 6 : object.type === 'pipe' ? Number(object.style?.pipeWidth ?? 14) : undefined}
                onChange={isSelected ? (pts) => onPathChange(object.id, pts) : undefined}
              />
            ) : (
              <>
                {!chromeless ? <span className="object-title">{object.name}</span> : null}
                {!chromeless ? <span className="object-text">{object.text || object.type}</span> : null}
                {!chromeless && object.binding?.tagName ? <span className="object-binding">Tag: {object.binding.tagName}</span> : null}
              </>
            )}
            {isSelected && !object.locked && !isPathWire ? (
              <div
                className="editor-resize-handle"
                role="presentation"
                onMouseDown={(e) => onResizeStart(e, object)}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
