import { useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { resolveCableEndpoints, resolveWireEndpoints } from '@energylink/graphics-runtime';

const NODE_TYPES = new Set(['elecsymbol', 'viewport3d', 'image', 'zone3d']);

type LogicNode = {
  id: string;
  label: string;
  sub: string;
  color: string;
  col: number;
  row: number;
};

type LogicEdge = {
  from: string;
  to: string;
  kind: 'wire' | 'cable';
};

const NODE_W = 168;
const NODE_H = 58;
const GAP_X = 52;
const GAP_Y = 28;
const PAD = 40;

function buildLogicGraph(objects: GraphicObjectDefinition[]) {
  const nodes: LogicNode[] = [];
  const nodeIds = new Set<string>();
  const edges: LogicEdge[] = [];

  const equip = objects.filter((o) => o.visible !== false && NODE_TYPES.has(o.type));
  const colors = ['#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#fb7185', '#38bdf8'];

  equip.forEach((o, i) => {
    nodeIds.add(o.id);
    nodes.push({
      id: o.id,
      label: o.name || o.text || o.type,
      sub: String(o.style?.symbolId ?? o.type),
      color: colors[i % colors.length],
      col: Math.floor(i / 4),
      row: i % 4,
    });
  });

  for (const obj of objects) {
    if (obj.visible === false) continue;
    if (obj.type === 'flowpath') {
      const ep = resolveWireEndpoints(obj.style);
      if (ep.fromObjectId && ep.toObjectId) {
        edges.push({ from: ep.fromObjectId, to: ep.toObjectId, kind: 'wire' });
      }
    }
    if (obj.type === 'cable3d') {
      const ep = resolveCableEndpoints(obj.style);
      if (ep.fromObjectId && ep.toObjectId) {
        edges.push({ from: ep.fromObjectId, to: ep.toObjectId, kind: 'cable' });
      }
    }
  }

  return {
    nodes,
    edges: edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)),
  };
}

export type EditorLogicFlowOverlayProps = {
  objects: GraphicObjectDefinition[];
  selectedObjectId: string | null;
  onSelectObject: (id: string) => void;
  onClose: () => void;
};

export function EditorLogicFlowOverlay({
  objects,
  selectedObjectId,
  onSelectObject,
  onClose,
}: EditorLogicFlowOverlayProps) {
  const { nodes, edges } = useMemo(() => buildLogicGraph(objects), [objects]);

  const width = Math.max(520, PAD * 2 + (Math.max(0, ...nodes.map((n) => n.col)) + 1) * (NODE_W + GAP_X));
  const height = Math.max(360, PAD * 2 + 4 * (NODE_H + GAP_Y));

  const pos = (n: LogicNode) => ({
    x: PAD + n.col * (NODE_W + GAP_X),
    y: PAD + n.row * (NODE_H + GAP_Y),
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="gfx-logic-flow-overlay" role="region" aria-label="Logic flow view">
      <div className="gfx-logic-flow-head">
        <div className="gfx-logic-flow-title">
          <Icon icon="solar:diagram-up-bold-duotone" width="18" height="18" style={{ color: '#a78bfa' }} />
          <b>Logic Flow</b>
          <span className="gfx-logic-flow-meta">{nodes.length} nodes · {edges.length} links</span>
        </div>
        <button type="button" className="btn secondary tiny" onClick={onClose}>
          ← Canvas
        </button>
      </div>
      <div className="gfx-logic-flow-body">
        {nodes.length === 0 ? (
          <p className="gfx-logic-flow-empty">ยังไม่มีอุปกรณ์ — วาง elecsymbol / viewport3d แล้วเชื่อม Wire หรือ Cable 3D</p>
        ) : (
          <svg className="gfx-logic-flow-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
            {edges.map((e, i) => {
              const from = nodeMap.get(e.from);
              const to = nodeMap.get(e.to);
              if (!from || !to) return null;
              const f = pos(from);
              const t = pos(to);
              const x1 = f.x + NODE_W;
              const y1 = f.y + NODE_H / 2;
              const x2 = t.x;
              const y2 = t.y + NODE_H / 2;
              const mid = (x1 + x2) / 2;
              const stroke = e.kind === 'cable' ? '#a78bfa' : '#22d3ee';
              return (
                <path
                  key={`edge-${i}`}
                  d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2.5}
                  strokeDasharray={e.kind === 'cable' ? undefined : '7,5'}
                  opacity={0.85}
                />
              );
            })}
            {nodes.map((n) => {
              const p = pos(n);
              const selected = n.id === selectedObjectId;
              return (
                <g
                  key={n.id}
                  className="gfx-logic-node"
                  onClick={() => onSelectObject(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={p.x}
                    y={p.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={12}
                    fill={selected ? 'rgba(56,189,248,0.18)' : 'rgba(15,23,42,0.75)'}
                    stroke={selected ? '#38bdf8' : n.color}
                    strokeWidth={selected ? 2.5 : 1.5}
                  />
                  <text x={p.x + 14} y={p.y + 24} fill="#f1f5f9" fontSize={12} fontWeight={700}>
                    {n.label.slice(0, 20)}
                  </text>
                  <text x={p.x + 14} y={p.y + 42} fill="#94a3b8" fontSize={10}>
                    {n.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <div className="gfx-logic-flow-legend">
          <span><i className="wire" /> Wire (flowpath)</span>
          <span><i className="cable" /> Cable 3D</span>
        </div>
      </div>
    </div>
  );
}
