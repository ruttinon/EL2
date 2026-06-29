import type { GraphicObjectDefinition } from '@energylink/shared-types';
import type { GraphicPort } from '@energylink/shared-types';
import { EditorPortOverlay, EditorWirePreview } from '../EditorPortOverlay';

const GRID_SIZE = 20;

export type EditorCanvasOverlaysProps = {
  graphicWidth: number;
  graphicHeight: number;
  layoutObjects: GraphicObjectDefinition[];
  canvasObjects: GraphicObjectDefinition[];
  selectedObjectId: string | null;
  activeTool: string;
  is3dCamera: boolean;
  wireFrom: { objectId: string; portId: string } | null;
  wireCursor: { x: number; y: number } | null;
  wallStart: { x: number; y: number } | null;
  wallCursor: { x: number; y: number } | null;
  roomPoints: Array<{ x: number; y: number }>;
  measurePoints: Array<{ x: number; y: number }>;
  openingSnap: { x: number; y: number; angleDeg: number; kind: 'door' | 'window' } | null;
  onPortClick: (objectId: string, port: GraphicPort) => void;
};

export function EditorCanvasOverlays({
  graphicWidth,
  graphicHeight,
  layoutObjects,
  canvasObjects,
  selectedObjectId,
  activeTool,
  is3dCamera,
  wireFrom,
  wireCursor,
  wallStart,
  wallCursor,
  roomPoints,
  measurePoints,
  openingSnap,
  onPortClick,
}: EditorCanvasOverlaysProps) {
  const wireToolActive = activeTool === 'wire' || activeTool === 'cable3d';

  return (
    <>
      <EditorPortOverlay
        objects={layoutObjects}
        selectedObjectId={selectedObjectId ?? ''}
        wireToolActive={wireToolActive}
        wireFrom={wireFrom}
        onPortClick={onPortClick}
      />
      {wireFrom && wireCursor ? (
        <EditorWirePreview objects={layoutObjects} wireFrom={wireFrom} cursor={wireCursor} />
      ) : null}
      {activeTool === 'wall' && wallStart && wallCursor ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: graphicWidth,
            height: graphicHeight,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <line
            x1={wallStart.x}
            y1={wallStart.y}
            x2={wallCursor.x}
            y2={wallCursor.y}
            stroke="#6366f1"
            strokeWidth="3"
            strokeDasharray="8,4"
          />
          <circle cx={wallStart.x} cy={wallStart.y} r={5} fill="#6366f1" />
          <circle cx={wallCursor.x} cy={wallCursor.y} r={4} fill="#a5b4fc" stroke="#6366f1" strokeWidth="1.5" />
          <text
            x={(wallStart.x + wallCursor.x) / 2 + 8}
            y={(wallStart.y + wallCursor.y) / 2 - 8}
            fill="#6366f1"
            fontSize="12"
            fontWeight="600"
            fontFamily="monospace"
          >
            {Math.round(Math.sqrt((wallCursor.x - wallStart.x) ** 2 + (wallCursor.y - wallStart.y) ** 2))}px
          </text>
        </svg>
      ) : null}
      {is3dCamera ? (
        <svg
          className="gfx-wall-plan-ghost"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: graphicWidth,
            height: graphicHeight,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          {canvasObjects.filter((o) => o.type === 'wall').map((object) => {
            const sx = Number(object.style?.wallStartX ?? object.x);
            const sy = Number(object.style?.wallStartY ?? object.y);
            const ex = Number(object.style?.wallEndX ?? object.x + object.width);
            const ey = Number(object.style?.wallEndY ?? object.y);
            const isSelected = object.id === selectedObjectId;
            return (
              <line
                key={`ghost-${object.id}`}
                x1={sx}
                y1={sy}
                x2={ex}
                y2={ey}
                stroke={isSelected ? '#a5b4fc' : '#94a3b8'}
                strokeWidth={isSelected ? 4 : 2}
                strokeOpacity={0.55}
              />
            );
          })}
        </svg>
      ) : null}
      {activeTool === 'room' && roomPoints.length > 0 ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: graphicWidth,
            height: graphicHeight,
            pointerEvents: 'none',
            zIndex: 9998,
          }}
        >
          {roomPoints.map((point, index) => (
            <circle key={`room-corner-${index}`} cx={point.x} cy={point.y} r={5} fill="#6366f1" />
          ))}
          {roomPoints.length > 1 ? (
            <polyline
              points={roomPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(99,102,241,0.08)"
              stroke="#6366f1"
              strokeWidth="2"
              strokeDasharray="6,4"
            />
          ) : null}
        </svg>
      ) : null}
      {openingSnap ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: graphicWidth,
            height: graphicHeight,
            pointerEvents: 'none',
            zIndex: 9997,
          }}
        >
          <g transform={`rotate(${openingSnap.angleDeg} ${openingSnap.x} ${openingSnap.y})`}>
            <rect
              x={openingSnap.x - (openingSnap.kind === 'door' ? 24 : 28)}
              y={openingSnap.y - (openingSnap.kind === 'door' ? 40 : 10)}
              width={openingSnap.kind === 'door' ? 48 : 56}
              height={openingSnap.kind === 'door' ? 80 : 20}
              fill={openingSnap.kind === 'door' ? 'rgba(148,163,184,0.25)' : 'rgba(88,166,255,0.35)'}
              stroke={openingSnap.kind === 'door' ? '#94a3b8' : '#58a6ff'}
              strokeWidth={2}
              strokeDasharray="5,4"
              rx={openingSnap.kind === 'window' ? 3 : 0}
            />
          </g>
          <circle cx={openingSnap.x} cy={openingSnap.y} r={4} fill="#38bdf8" />
        </svg>
      ) : null}
      {(measurePoints.length > 0 || (activeTool === 'measure' && measurePoints.length === 1)) ? (
        <svg className="measure-overlay" width={graphicWidth} height={graphicHeight}>
          {measurePoints.map((p, i) => (
            <circle key={`m-${i}`} cx={p.x} cy={p.y} r={5} fill="#0ea5e9" />
          ))}
          {measurePoints.length === 2 ? (
            <>
              <line
                x1={measurePoints[0].x}
                y1={measurePoints[0].y}
                x2={measurePoints[1].x}
                y2={measurePoints[1].y}
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="6,4"
              />
              <text
                x={(measurePoints[0].x + measurePoints[1].x) / 2 + 8}
                y={(measurePoints[0].y + measurePoints[1].y) / 2 - 8}
                fill="#0369a1"
                fontSize="12"
                fontWeight="700"
                fontFamily="monospace"
              >
                {Math.round(Math.hypot(measurePoints[1].x - measurePoints[0].x, measurePoints[1].y - measurePoints[0].y))}px
              </text>
            </>
          ) : null}
        </svg>
      ) : null}
    </>
  );
}

export { GRID_SIZE as EDITOR_CANVAS_GRID_SIZE };
