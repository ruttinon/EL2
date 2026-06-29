import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { parsePorts, portCanvasPosition, findPort, type GraphicPort } from '@energylink/graphics-runtime';

export function EditorWirePreview({
  objects,
  wireFrom,
  cursor,
}: {
  objects: GraphicObjectDefinition[];
  wireFrom: { objectId: string; portId: string };
  cursor: { x: number; y: number };
}) {
  const fromObj = objects.find((o) => o.id === wireFrom.objectId);
  if (!fromObj) return null;
  const port = findPort(parsePorts(fromObj.style?.ports), wireFrom.portId);
  if (!port) return null;
  const from = portCanvasPosition(fromObj, port);
  return (
    <svg className="editor-wire-preview" aria-hidden>
      <line x1={from.x} y1={from.y} x2={cursor.x} y2={cursor.y} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" />
    </svg>
  );
}

export function EditorPortOverlay({
  objects,
  selectedObjectId,
  wireToolActive,
  wireFrom,
  onPortClick,
}: {
  objects: GraphicObjectDefinition[];
  selectedObjectId: string;
  wireToolActive: boolean;
  wireFrom: { objectId: string; portId: string } | null;
  onPortClick: (objectId: string, port: GraphicPort) => void;
}) {
  const portTypes = new Set(['elecsymbol', 'image', 'viewport3d', 'hotspot', 'bussection']);
  const showAll = wireToolActive;

  return (
    <>
      {objects.filter((o) => o.visible !== false && portTypes.has(o.type)).map((obj) => {
        const ports = parsePorts(obj.style?.ports);
        if (ports.length === 0) return null;
        const showPorts = showAll || obj.id === selectedObjectId;
        if (!showPorts) return null;

        return ports.map((port) => {
          const pos = portCanvasPosition(obj, port);
          const isFrom = wireFrom?.objectId === obj.id && wireFrom.portId === port.id;
          const isOut = port.kind === 'out' || port.kind === 'bidirectional';
          const isValidTarget = Boolean(
            wireFrom
            && wireFrom.objectId !== obj.id
            && (port.kind === 'in' || port.kind === 'bidirectional'),
          );
          return (
            <button
              key={`${obj.id}-${port.id}`}
              type="button"
              className={`editor-port-handle${isFrom ? ' wire-from' : ''}${isOut ? ' port-out' : ' port-in'}${isValidTarget ? ' wire-target' : ''}`}
              style={{ left: pos.x - 6, top: pos.y - 6 }}
              title={`${obj.name} · ${port.label ?? port.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onPortClick(obj.id, port);
              }}
            />
          );
        });
      })}
    </>
  );
}
