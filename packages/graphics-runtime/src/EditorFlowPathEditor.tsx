import React from 'react';
import { parsePathPoints, pathPointsToPolyline, formatPathPoints, type PathPoint } from './sld';

function snapVal(v: number, grid: number) {
  if (!grid) return Math.round(v);
  return Math.round(v / grid) * grid;
}

export function EditorFlowPathEditor({
  points,
  width,
  height,
  editable = false,
  gridSnap = 0,
  strokeColor = '#22d3ee',
  strokeWidth = 3,
  onChange,
}: {
  points: PathPoint[];
  width: number;
  height: number;
  editable?: boolean;
  gridSnap?: number;
  strokeColor?: string;
  strokeWidth?: number;
  onChange?: (points: PathPoint[]) => void;
}) {
  const pts = points.length >= 2 ? points : parsePathPoints(undefined, width, height);
  const poly = pathPointsToPolyline(pts);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const ptsRef = React.useRef(pts);
  ptsRef.current = pts;

  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (dragIdx === null || !onChange) return undefined;

    function onMove(e: MouseEvent) {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const x = snapVal(e.clientX - rect.left, gridSnap);
      const y = snapVal(e.clientY - rect.top, gridSnap);
      const next = ptsRef.current.map((p, i) =>
        i === dragIdx ? { x: Math.max(0, Math.min(width, x)), y: Math.max(0, Math.min(height, y)) } : p,
      );
      ptsRef.current = next;
      onChange?.(next);
    }

    function onUp() {
      setDragIdx(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragIdx, onChange, gridSnap, width, height]);

  return (
    <div ref={hostRef} data-flowpath-host className="editor-flowpath-host" style={{ position: 'absolute', inset: 0, pointerEvents: editable ? 'auto' : 'none' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <polyline
          points={poly}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={editable ? '8 6' : undefined}
          opacity={0.95}
        />
        {editable &&
          pts.map((p, i) => (
            <circle
              key={i}
              data-flowpath-drag={i}
              cx={p.x}
              cy={p.y}
              r={7}
              className="editor-flowpath-handle"
              fill="#fff"
              stroke="#0891b2"
              strokeWidth="2"
              style={{ cursor: dragIdx === i ? 'grabbing' : 'grab' }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragIdx(i);
              }}
            />
          ))}
      </svg>
    </div>
  );
}

export function EditorFlowPathPreview({ points, width, height }: { points: PathPoint[]; width: number; height: number }) {
  return <EditorFlowPathEditor points={points} width={width} height={height} editable={false} />;
}

export { formatPathPoints };
