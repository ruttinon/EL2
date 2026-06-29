import React from 'react';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type DiagramViewportProps = {
  enabled?: boolean;
  stageWidth: number;
  stageHeight: number;
  className?: string;
  children: React.ReactNode;
};

export function DiagramViewport({
  enabled = false,
  stageWidth,
  stageHeight,
  className = '',
  children,
}: DiagramViewportProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const fitToView = React.useCallback(() => {
    const el = containerRef.current;
    if (!el || !stageWidth || !stageHeight) return;
    const pad = 24;
    const availW = Math.max(1, el.clientWidth - pad * 2);
    const availH = Math.max(1, el.clientHeight - pad * 2);
    const nextZoom = clamp(Math.min(availW / stageWidth, availH / stageHeight), MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    setPan({
      x: Math.round((el.clientWidth - stageWidth * nextZoom) / 2),
      y: Math.round((el.clientHeight - stageHeight * nextZoom) / 2),
    });
  }, [stageWidth, stageHeight]);

  React.useEffect(() => {
    if (!enabled) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    fitToView();
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => fitToView());
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled, fitToView]);

  const onWheel = React.useCallback((event: React.WheelEvent) => {
    if (!enabled) return;
    event.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    setZoom((current) => {
      const next = clamp(current * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = next / current;
      setPan((p) => ({
        x: cursorX - (cursorX - p.x) * ratio,
        y: cursorY - (cursorY - p.y) * ratio,
      }));
      return next;
    });
  }, [enabled]);

  const onPointerDown = React.useCallback((event: React.PointerEvent) => {
    if (!enabled || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.diagram-toolbar')) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [enabled, pan.x, pan.y]);

  const onPointerMove = React.useCallback((event: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.panX + (event.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (event.clientY - dragRef.current.startY),
    });
  }, []);

  const onPointerUp = React.useCallback((event: React.PointerEvent) => {
    dragRef.current = null;
    setDragging(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`diagram-viewport${dragging ? ' diagram-dragging' : ''} ${className}`.trim()}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={fitToView}
    >
      <div className="diagram-toolbar" role="toolbar" aria-label="Diagram zoom controls">
        <button type="button" title="Zoom in" onClick={() => setZoom((z) => clamp(z * 1.2, MIN_ZOOM, MAX_ZOOM))}>+</button>
        <button type="button" title="Zoom out" onClick={() => setZoom((z) => clamp(z / 1.2, MIN_ZOOM, MAX_ZOOM))}>−</button>
        <button type="button" title="Fit to view" onClick={fitToView}>Fit</button>
        <button type="button" title="Reset zoom" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>1:1</button>
        <span className="diagram-zoom-label">{Math.round(zoom * 100)}%</span>
      </div>
      <div
        className="diagram-viewport-canvas"
        style={{
          width: stageWidth,
          height: stageHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
    </div>
  );
}
