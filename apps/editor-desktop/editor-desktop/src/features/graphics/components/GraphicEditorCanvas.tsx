import type { MouseEvent, RefObject } from 'react';
import { Icon } from '@iconify/react';
import type { GraphicObjectDefinition, GraphicPort, GraphicSummary, UnifiedCameraPreset } from '@energylink/shared-types';
import type { CurrentTagValue } from '@energylink/graphics-runtime';
import { GraphicNavigationBar } from '@energylink/graphics-runtime';
import { UnifiedViewport } from '@energylink/unified-viewport';
import { FullscreenPanel } from '../../../components/FullscreenPanel';
import { GraphicEditorDiagram } from './GraphicEditorDiagram';
import { EditorCanvasOverlays, EDITOR_CANVAS_GRID_SIZE } from './EditorCanvasOverlays';
import { EditorLogicFlowOverlay } from './EditorLogicFlowOverlay';
import { EditorFloatingHud } from './EditorFloatingHud';
import { EditorScadaDashboardView } from './EditorScadaDashboardView';
import { EditorArmedBanner } from './EditorArmedBanner';
import type { EditorViewMode } from './GraphicEditorToolbar';

export type GraphicEditorCanvasProps = {
  selectedGraphic: GraphicSummary | null;
  floorLevels: number[];
  activeFloor: number | null;
  onFloorChange: (floor: number | null) => void;
  activeTool: string;
  is3dCamera: boolean;
  cameraPreset: UnifiedCameraPreset;
  canvasZoom: number;
  viewportObjects: GraphicObjectDefinition[];
  canvasObjects: GraphicObjectDefinition[];
  canvasPointerActive: boolean;
  gridEnabled: boolean;
  selectedObjectId: string | null;
  pathEditId: string | null;
  editorCurrentValues: CurrentTagValue[];
  r3fTagValues: Map<string, { value?: unknown }>;
  wireFrom: { objectId: string; portId: string } | null;
  wireCursor: { x: number; y: number } | null;
  wallStart: { x: number; y: number } | null;
  wallCursor: { x: number; y: number } | null;
  roomPoints: Array<{ x: number; y: number }>;
  measurePoints: Array<{ x: number; y: number }>;
  openingSnap: { x: number; y: number; angleDeg: number; kind: 'door' | 'window' } | null;
  editorViewMode: EditorViewMode;
  floatingHudEnabled: boolean;
  onEditorViewModeChange: (mode: EditorViewMode) => void;
  catalogArmedLabel: string | null;
  onDisarmCatalog: () => void;
  floorClickEnabled: boolean;
  activeToolLabel: string;
  toolHint: string;
  canvasRef: RefObject<HTMLDivElement | null>;
  canvasScrollRef: RefObject<HTMLDivElement | null>;
  flowPreviewEnabled?: boolean;
  onPanMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onCanvasClick: (e: MouseEvent<HTMLDivElement>) => void;
  onCanvasDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onMouseMove: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: MouseEvent<HTMLDivElement>) => void;
  onSelectObject: (id: string) => void;
  onUpdateObject: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  onZonePaint: (x: number, y: number) => void;
  onFloorClick: (x: number, y: number) => void;
  onDragStart: (e: MouseEvent<HTMLButtonElement>, object: GraphicObjectDefinition) => void;
  onResizeStart: (e: MouseEvent<HTMLDivElement>, object: GraphicObjectDefinition) => void;
  onPathChange: (objectId: string, points: Array<{ x: number; y: number }>) => void;
  onPortClick: (objectId: string, port: GraphicPort) => void;
};

export function GraphicEditorCanvas({
  selectedGraphic,
  floorLevels,
  activeFloor,
  onFloorChange,
  activeTool,
  is3dCamera,
  cameraPreset,
  canvasZoom,
  viewportObjects,
  canvasObjects,
  canvasPointerActive,
  gridEnabled,
  selectedObjectId,
  pathEditId,
  editorCurrentValues,
  r3fTagValues,
  wireFrom,
  wireCursor,
  wallStart,
  wallCursor,
  roomPoints,
  measurePoints,
  openingSnap,
  editorViewMode,
  floatingHudEnabled,
  onEditorViewModeChange,
  catalogArmedLabel,
  onDisarmCatalog,
  floorClickEnabled,
  activeToolLabel,
  toolHint,
  flowPreviewEnabled = true,
  canvasRef,
  canvasScrollRef,
  onPanMouseDown,
  onCanvasClick,
  onCanvasDrop,
  onMouseMove,
  onMouseUp,
  onSelectObject,
  onUpdateObject,
  onZonePaint,
  onFloorClick,
  onDragStart,
  onResizeStart,
  onPathChange,
  onPortClick,
}: GraphicEditorCanvasProps) {
  const grid = EDITOR_CANVAS_GRID_SIZE;

  return (
    <div className={`gfx-canvas-shell${flowPreviewEnabled ? '' : ' gfx-flow-paused'}${editorViewMode === 'logic' ? ' gfx-logic-mode' : ''}${editorViewMode === 'dashboard' ? ' gfx-dashboard-mode' : ''}`}>
      {selectedGraphic && floorLevels.length > 0 ? (
        <GraphicNavigationBar
          canGoBack={false}
          onBack={() => undefined}
          floors={floorLevels}
          activeFloor={activeFloor}
          onFloorChange={onFloorChange}
          className="graphics-editor-floor-bar"
        />
      ) : null}
      {selectedGraphic && catalogArmedLabel && editorViewMode === 'canvas' ? (
        <EditorArmedBanner label={catalogArmedLabel} onCancel={onDisarmCatalog} />
      ) : null}
      <div
        className={`graphic-canvas-scroll${is3dCamera ? ' isometric-mode' : ''}${activeTool === 'pan' ? ' pan-mode' : ''}`}
        ref={canvasScrollRef as RefObject<HTMLDivElement>}
        onMouseDown={onPanMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <FullscreenPanel className="editor-canvas-fullscreen-panel" label="ขยาย Canvas เต็มจอ">
          {selectedGraphic ? (
            <div
              className="graphic-canvas-zoom-wrap"
              style={{
                width: Math.round(selectedGraphic.width * canvasZoom),
                height: Math.round(selectedGraphic.height * canvasZoom),
              }}
            >
              <UnifiedViewport
                mode="editor"
                width={selectedGraphic.width}
                height={selectedGraphic.height}
                cameraPreset={cameraPreset}
                objects={viewportObjects}
                backgroundColor={selectedGraphic.layout?.backgroundColor || '#fbfdff'}
                canvasZoom={canvasZoom}
                diagramPointerActive={canvasPointerActive}
                selectedObjectId={selectedObjectId}
                onSelectObject={onSelectObject}
                onUpdateObject={onUpdateObject}
                eventSource={canvasRef as RefObject<HTMLElement>}
                valuesByTag={r3fTagValues}
                zonePaintEnabled={is3dCamera && activeTool === 'zone3d'}
                onZonePaint={onZonePaint}
                floorClickEnabled={floorClickEnabled}
                onFloorClick={onFloorClick}
              >
                <div
                  ref={canvasRef as RefObject<HTMLDivElement>}
                  className={`graphic-canvas${pathEditId ? ' path-edit-mode' : ''}${is3dCamera ? ' gfx-3d-companion' : ''}${canvasPointerActive ? ' gfx-canvas-tools-active' : ''}`}
                  style={{
                    width: selectedGraphic.width,
                    height: selectedGraphic.height,
                    backgroundColor: 'transparent',
                    backgroundImage: gridEnabled && !is3dCamera
                      ? 'linear-gradient(rgba(100,116,139,0.3) 1px,transparent 1px), linear-gradient(90deg,rgba(100,116,139,0.3) 1px,transparent 1px)'
                      : undefined,
                    backgroundSize: gridEnabled && !is3dCamera ? `${grid}px ${grid}px, ${grid}px ${grid}px` : undefined,
                    backgroundPosition: gridEnabled && !is3dCamera ? 'left top, left top' : undefined,
                    backgroundRepeat: gridEnabled && !is3dCamera ? 'repeat, repeat' : undefined,
                  }}
                  onClick={onCanvasClick}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onCanvasDrop}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                >
                  <GraphicEditorDiagram
                    width={selectedGraphic.width}
                    height={selectedGraphic.height}
                    objects={canvasObjects}
                    is3dCamera={is3dCamera}
                    activeFloor={activeFloor}
                    backgroundColor={selectedGraphic.layout?.backgroundColor || '#fbfdff'}
                    backgroundImage={selectedGraphic.layout?.backgroundImage}
                    gridEnabled={gridEnabled}
                    selectedObjectId={selectedObjectId}
                    pathEditId={pathEditId}
                    currentValues={editorCurrentValues}
                    onSelectObject={onSelectObject}
                    onDragStart={onDragStart}
                    onResizeStart={onResizeStart}
                    onPathChange={onPathChange}
                  >
                    <EditorCanvasOverlays
                      graphicWidth={selectedGraphic.width}
                      graphicHeight={selectedGraphic.height}
                      layoutObjects={selectedGraphic.layout?.objects ?? []}
                      canvasObjects={canvasObjects}
                      selectedObjectId={selectedObjectId}
                      activeTool={activeTool}
                      is3dCamera={is3dCamera}
                      wireFrom={wireFrom}
                      wireCursor={wireCursor}
                      wallStart={wallStart}
                      wallCursor={wallCursor}
                      roomPoints={roomPoints}
                      measurePoints={measurePoints}
                      openingSnap={openingSnap}
                      onPortClick={onPortClick}
                    />
                    {is3dCamera && floatingHudEnabled ? (
                      <EditorFloatingHud
                        objects={canvasObjects}
                        currentValues={editorCurrentValues}
                        selectedObjectId={selectedObjectId}
                        showAllBound={!selectedObjectId}
                      />
                    ) : null}
                  </GraphicEditorDiagram>
                </div>
              </UnifiedViewport>
            </div>
          ) : (
            <div className="empty-designer">No Graphic selected. Please create or select a Graphic first.</div>
          )}
        </FullscreenPanel>
      </div>
      {selectedGraphic && editorViewMode === 'logic' ? (
        <EditorLogicFlowOverlay
          objects={selectedGraphic.layout?.objects ?? []}
          selectedObjectId={selectedObjectId}
          onSelectObject={onSelectObject}
          onClose={() => onEditorViewModeChange('canvas')}
        />
      ) : null}
      {selectedGraphic && editorViewMode === 'dashboard' ? (
        <EditorScadaDashboardView
          graphic={selectedGraphic}
          currentValues={editorCurrentValues}
          onClose={() => onEditorViewModeChange('canvas')}
        />
      ) : null}
      {selectedGraphic ? (
        <div className="gfx-status-bar" role="status">
          <div className="gfx-status-hint">
            <span className="gfx-active-tool">{activeToolLabel}</span>
            <Icon icon="solar:info-circle-bold-duotone" width="14" height="14" style={{ flexShrink: 0, color: '#0ea5e9' }} />
            <span>{toolHint}</span>
          </div>
          <div className="gfx-status-meta">
            <span>{gridEnabled ? `Grid ${grid}px` : 'Grid off'}</span>
            <span>{is3dCamera ? '3D WebGL' : '2D edit'}</span>
            <span>{cameraPreset.toUpperCase()}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
