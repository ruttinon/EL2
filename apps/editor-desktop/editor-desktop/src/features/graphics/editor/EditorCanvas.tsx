import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GraphicObjectDefinition, GraphicLayout, UnifiedCameraPreset } from '@energylink/shared-types';
import type { CurrentTagValue, RuntimeAlarm, WriteTagOptions, HtmlAnchorMap } from '@energylink/graphics-runtime';
import { HtmlGraphicPage, resolveAnchoredObjects } from '@energylink/graphics-runtime';
import { DiagramLayer, UnifiedViewport, splitObjectsByUnifiedLayer } from '@energylink/unified-viewport';
import '@energylink/unified-viewport/src/unified-viewport.css';
import { editorRuntimeApi } from '../../../api/editorRuntimeApi';
import { DEFAULT_GRID_SIZE } from '../../editorGrid';
import { EditorGridOverlay } from '../../EditorGridOverlay';
import type { SceneCatalogDropPayload } from '../GraphicsSceneCatalog';
import { SCENE_CATALOG_MIME } from '../GraphicsSceneCatalog';
import {
  parsePolygonPointString,
  formatPolygonPointString,
  scalePolygonPoints,
} from '@energylink/graphics-runtime';

const MIN_SIZE = 8;

const WORLD_FIT_TYPES = new Set(['wall', 'zone3d', 'viewport3d', 'scene3d', 'cable3d']);

function computeObjectsBounds(objects: GraphicObjectDefinition[]) {
  const vis = objects.filter((o) => o.visible !== false);
  if (vis.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of vis) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export type EditorCanvasProps = {
  objects: GraphicObjectDefinition[];
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string | null;
  zoom: number;
  gridEnabled: boolean;
  gridSize?: number;
  gridStyle?: 'lines' | 'dots';
  snap: boolean;
  mode: '2d' | '3d';
  camera: UnifiedCameraPreset;
  placing: boolean;
  selectedIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null, options?: { additive?: boolean }) => void;
  onPlace: (x: number, y: number) => void;
  onMutate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  onNavigate?: (graphicId: string) => void;
  onWriteTag?: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
  livePreview?: boolean;
  runMode?: boolean;
  onDropFiles?: (files: FileList, x: number, y: number) => void;
  onDropScenePayload?: (payload: SceneCatalogDropPayload, x: number, y: number) => void;
  panning?: boolean;
  /** Graphic id — triggers scroll-to-content when changed */
  graphicId?: string | null;
  currentValues?: CurrentTagValue[];
  alarms?: RuntimeAlarm[];
  /** When set, renders imported HTML as full-page background under SCADA overlay. */
  htmlLayout?: GraphicLayout | null;
  resolveAssetRef?: (ref: string) => string;
  /** widgets = edit overlay, html = orbit/pan HTML scene, run = full runtime */
  htmlFocus?: 'widgets' | 'html' | 'run';
  /** Live anchor positions reported from HTML iframe (`data-el-anchor`). */
  htmlAnchors?: HtmlAnchorMap;
  onHtmlAnchorsChange?: (anchors: HtmlAnchorMap) => void;
  /** Click an anchor dot — bind selected widget or place tool. */
  onAnchorPick?: (anchor: { id: string; x: number; y: number; label?: string }) => void;
  activeFloor?: number | null;
};

function snapVal(v: number, snap: boolean, gridSize: number) {
  if (!snap) return Math.round(v);
  return Math.round(v / gridSize) * gridSize;
}

function hitObjectAt(objects: GraphicObjectDefinition[], x: number, y: number) {
  const sorted = [...objects]
    .filter((o) => o.visible !== false)
    .sort((a, b) => (b.layer ?? 0) - (a.layer ?? 0));
  return sorted.find(
    (o) => x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height,
  ) ?? null;
}

function canvasPointFromEvent(
  e: ReactPointerEvent | globalThis.PointerEvent,
  pageEl: HTMLDivElement | null,
  zoom: number,
) {
  const rect = pageEl?.getBoundingClientRect();
  if (!rect) return null;
  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom,
  };
}

export function EditorCanvas(props: EditorCanvasProps) {
  const {
    objects, width, height, backgroundColor, backgroundImage,
    zoom, gridEnabled, gridSize = DEFAULT_GRID_SIZE, gridStyle = 'lines', snap, mode, camera, placing,
    selectedIds, selectedId, onSelect, onPlace, onMutate, onNavigate, onWriteTag,
    livePreview = false, runMode = false, onDropFiles, onDropScenePayload,
    panning = false, graphicId = null,
    currentValues = [], alarms = [],
    htmlLayout = null, resolveAssetRef,
    htmlFocus = 'widgets',
    htmlAnchors = new Map(),
    onHtmlAnchorsChange,
    onAnchorPick,
    activeFloor = null,
  } = props;

  const isHtmlComposite = Boolean(htmlLayout);
  const htmlInteractive = isHtmlComposite && (htmlFocus === 'html' || htmlFocus === 'run');
  const widgetEditing = !isHtmlComposite || htmlFocus === 'widgets';
  const showAnchorDots = isHtmlComposite && widgetEditing && htmlAnchors.size > 0;

  const displayObjects = useMemo(
    () => (isHtmlComposite ? resolveAnchoredObjects(objects, htmlAnchors) : objects),
    [objects, htmlAnchors, isHtmlComposite],
  );

  const anchorsRef = useRef(htmlAnchors);
  anchorsRef.current = htmlAnchors;
  const displayObjectsRef = useRef(displayObjects);
  displayObjectsRef.current = displayObjects;

  const boundAnchorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const o of objects) {
      const aid = String(o.style?.anchorId ?? '').trim();
      if (aid) ids.add(aid);
    }
    return ids;
  }, [objects]);

  const runtimeActive = livePreview || runMode;

  const fetchTrend = useCallback(
    async (opts: {
      tagId: string;
      from?: string;
      to?: string;
      limit?: number;
      points?: number;
      bucketMs?: number;
      agg?: 'avg' | 'min' | 'max' | 'first' | 'last';
    }) => {
      if (!runtimeActive) return null;
      // Auto-downsample long ranges (DAQ style) unless an explicit limit is set.
      const shouldDownsample =
        opts.points === undefined && opts.bucketMs === undefined && opts.limit === undefined && !!opts.from && !!opts.to;
      const res = await editorRuntimeApi.getTrend(shouldDownsample ? { ...opts, points: 500 } : opts);
      return res.ok ? res.data : null;
    },
    [runtimeActive],
  );

  const onCanvasDragOver = (e: React.DragEvent) => {
    if (runMode) return;
    if (e.dataTransfer.types.includes(SCENE_CATALOG_MIME) || e.dataTransfer.files.length > 0) {
      e.preventDefault();
    }
  };

  const onCanvasDrop = (e: React.DragEvent) => {
    if (runMode) return;
    e.preventDefault();
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const catalogRaw = e.dataTransfer.getData(SCENE_CATALOG_MIME);
    if (catalogRaw && onDropScenePayload) {
      try {
        const payload = JSON.parse(catalogRaw) as SceneCatalogDropPayload;
        onDropScenePayload(payload, x, y);
      } catch {
        // ignore bad payload
      }
      return;
    }

    if (!onDropFiles || !e.dataTransfer.files.length) return;
    onDropFiles(e.dataTransfer.files, x, y);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  const onPanMove = useCallback((e: globalThis.PointerEvent) => {
    const p = panRef.current;
    const el = scrollRef.current;
    if (!p || !el) return;
    el.scrollLeft = p.scrollLeft - (e.clientX - p.startX);
    el.scrollTop = p.scrollTop - (e.clientY - p.startY);
  }, []);

  const endPan = useCallback(() => {
    panRef.current = null;
    window.removeEventListener('pointermove', onPanMove);
    window.removeEventListener('pointerup', endPan);
  }, [onPanMove]);

  useEffect(() => () => endPan(), [endPan]);

  const pageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | { kind: 'move'; ids: string[]; startX: number; startY: number; origins: Map<string, { x: number; y: number }> }
    | { kind: 'resize'; id: string; handle: Handle; startX: number; startY: number; ox: number; oy: number; ow: number; oh: number }
    | null
  >(null);

  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const onWindowMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      if (d.kind === 'move') {
        for (const id of d.ids) {
          const origin = d.origins.get(id);
          if (!origin) continue;
          const obj = objectsRef.current.find((x) => x.id === id);
          const newX = snapVal(origin.x + dx, snap, gridSize);
          const newY = snapVal(origin.y + dy, snap, gridSize);
          if (!obj) {
            onMutate(id, { x: newX, y: newY });
            continue;
          }
          const anchorId = String(obj.style?.anchorId ?? '').trim();
          if (isHtmlComposite && anchorId) {
            const anchor = anchorsRef.current.get(anchorId);
            if (anchor) {
              const cx = newX + obj.width / 2;
              const cy = newY + obj.height / 2;
              onMutate(id, {
                style: {
                  ...obj.style,
                  anchorOffsetX: Math.round(cx - anchor.x),
                  anchorOffsetY: Math.round(cy - anchor.y),
                },
              });
              continue;
            }
          }
          onMutate(id, { x: newX, y: newY });
        }
        return;
      }
      let { ox, oy, ow, oh } = d;
      const h = d.handle;
      if (h.includes('e')) ow = Math.max(MIN_SIZE, d.ow + dx);
      if (h.includes('s')) oh = Math.max(MIN_SIZE, d.oh + dy);
      if (h.includes('w')) {
        ow = Math.max(MIN_SIZE, d.ow - dx);
        ox = d.ox + (d.ow - ow);
      }
      if (h.includes('n')) {
        oh = Math.max(MIN_SIZE, d.oh - dy);
        oy = d.oy + (d.oh - oh);
      }

      const obj = objectsRef.current.find((o) => o.id === d.id);
      if (!obj) return;

      if (obj.type === 'circle' || obj.style?.lockAspectRatio === true) {
        const size = Math.max(MIN_SIZE, Math.max(ow, oh));
        onMutate(d.id, {
          x: snapVal(ox, snap, gridSize),
          y: snapVal(oy, snap, gridSize),
          width: snapVal(size, snap, gridSize),
          height: snapVal(size, snap, gridSize),
        });
        return;
      }

      if (obj.type === 'line') {
        const prevSw = Math.max(1, Number(obj.style?.strokeWidth ?? d.oh));
        const newSw = h.includes('n') || h.includes('s') ? Math.max(1, oh) : prevSw;
        onMutate(d.id, {
          x: snapVal(ox, snap, gridSize),
          y: snapVal(oy, snap, gridSize),
          width: snapVal(ow, snap, gridSize),
          height: Math.max(12, newSw + 4),
          style: { ...obj.style, strokeWidth: newSw, background: obj.style?.stroke ?? obj.style?.background },
        });
        return;
      }

      if (obj.type === 'polygon') {
        const from = { x: d.ox, y: d.oy, w: d.ow, h: d.oh };
        const to = { x: ox, y: oy, w: ow, h: oh };
        const pts = parsePolygonPointString(obj.style?.polygonPoints);
        const scaled = pts.length >= 3 ? scalePolygonPoints(pts, from, to) : pts;
        onMutate(d.id, {
          x: snapVal(ox, snap, gridSize),
          y: snapVal(oy, snap, gridSize),
          width: snapVal(ow, snap, gridSize),
          height: snapVal(oh, snap, gridSize),
          ...(scaled.length >= 3
            ? { style: { ...obj.style, polygonPoints: formatPolygonPointString(scaled) } }
            : {}),
        });
        return;
      }

      onMutate(d.id, {
        x: snapVal(ox, snap, gridSize),
        y: snapVal(oy, snap, gridSize),
        width: snapVal(ow, snap, gridSize),
        height: snapVal(oh, snap, gridSize),
      });
    },
    [onMutate, snap, zoom, isHtmlComposite, gridSize],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onWindowMove]);

  useEffect(() => () => endDrag(), [endDrag]);

  const beginMove = (e: ReactPointerEvent, obj: GraphicObjectDefinition) => {
    // In live preview, clicking an object with a navigation target switches screens
    // (so designers can test page links without leaving the editor).
    if (livePreview && obj.navigateTo && onNavigate) {
      e.stopPropagation();
      onNavigate(obj.navigateTo);
      return;
    }
    if (obj.locked) {
      onSelect(obj.id);
      return;
    }
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      onSelect(obj.id, { additive: true });
      return;
    }
    if (!selectedIdsRef.current.includes(obj.id)) {
      onSelect(obj.id);
    }
    const idsToMove = selectedIdsRef.current.includes(obj.id) && selectedIdsRef.current.length > 1
      ? selectedIdsRef.current
      : [obj.id];
    const origins = new Map<string, { x: number; y: number }>();
    const display = displayObjectsRef.current;
    for (const id of idsToMove) {
      const o = display.find((x) => x.id === id);
      if (o) origins.set(id, { x: o.x, y: o.y });
    }
    dragRef.current = { kind: 'move', ids: idsToMove, startX: e.clientX, startY: e.clientY, origins };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', endDrag);
  };

  const beginResize = (e: ReactPointerEvent, obj: GraphicObjectDefinition, handle: Handle) => {
    e.stopPropagation();
    onSelect(obj.id);
    dragRef.current = {
      kind: 'resize', id: obj.id, handle,
      startX: e.clientX, startY: e.clientY,
      ox: obj.x, oy: obj.y, ow: obj.width, oh: obj.height,
    };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', endDrag);
  };

  const onInteractionPointerDown = (e: ReactPointerEvent, hitObjects: GraphicObjectDefinition[]) => {
    if ((e.target as HTMLElement).closest('.ec-handle')) return;
    const pt = canvasPointFromEvent(e, pageRef.current, zoom);
    if (!pt) return;

    if (panning && scrollRef.current) {
      e.preventDefault();
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: scrollRef.current.scrollLeft,
        scrollTop: scrollRef.current.scrollTop,
      };
      window.addEventListener('pointermove', onPanMove);
      window.addEventListener('pointerup', endPan);
      return;
    }

    const hit = hitObjectAt(hitObjects, pt.x, pt.y);
    if (hit) {
      beginMove(e, hit);
      return;
    }

    if (placing) {
      onPlace(pt.x, pt.y);
      return;
    }

    onSelect(null);
  };

  const renderInteraction = (hitObjects: GraphicObjectDefinition[]) => {
    const primaryId = selectedIds[selectedIds.length - 1] ?? null;
    return (
      <div
        className="ec-interaction"
        onPointerDown={(e) => onInteractionPointerDown(e, hitObjects)}
      >
        {hitObjects.map((obj) =>
          obj.visible === false ? null : (
            <div
              key={obj.id}
              className={`ec-hit${selectedIds.includes(obj.id) ? ' selected' : ''}${obj.locked ? ' locked' : ''}`}
              style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height }}
              title={obj.name ?? obj.type}
            />
          ),
        )}
        {selectedIds.map((sid) => {
          const obj = hitObjects.find((o) => o.id === sid);
          if (!obj || obj.visible === false) return null;
          const isPrimary = sid === primaryId;
          return (
            <div
              key={`sel-${sid}`}
              className={`ec-select-box${isPrimary ? '' : ' ec-select-secondary'}${selectedIds.length > 1 ? ' ec-select-multi' : ''}`}
              style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height }}
            >
              {isPrimary && selectedIds.length === 1 && !obj.locked &&
                HANDLES.map((h) => (
                  <span
                    key={h}
                    className={`ec-handle ec-handle-${h}`}
                    onPointerDown={(ev) => beginResize(ev, obj, h)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    );
  };

  const onPagePointerDown = (e: ReactPointerEvent) => {
    if (e.target !== e.currentTarget) return;
    const pt = canvasPointFromEvent(e, pageRef.current, zoom);
    if (!pt) return;

    if (panning && scrollRef.current) {
      e.preventDefault();
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: scrollRef.current.scrollLeft,
        scrollTop: scrollRef.current.scrollTop,
      };
      window.addEventListener('pointermove', onPanMove);
      window.addEventListener('pointerup', endPan);
      return;
    }

    if (placing) {
      onPlace(pt.x, pt.y);
    } else {
      onSelect(null);
    }
  };

  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: width, h: height });
  useEffect(() => {
    if (mode !== '3d') return undefined;
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setStage((prev) =>
          prev.w === Math.round(r.width) && prev.h === Math.round(r.height)
            ? prev
            : { w: Math.round(r.width), h: Math.round(r.height) },
        );
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  const { flat: diagramObjects } = useMemo(() => splitObjectsByUnifiedLayer(objects), [objects]);
  const worldCount = useMemo(
    () => objects.filter((o) => o.visible !== false && WORLD_FIT_TYPES.has(o.type)).length,
    [objects],
  );

  const lastFitGraphic = useRef<string>('');
  useEffect(() => {
    if (mode !== '2d' || objects.length === 0 || !graphicId) return;
    if (lastFitGraphic.current === graphicId) return;
    lastFitGraphic.current = graphicId;
    const bounds = computeObjectsBounds(objects);
    const el = scrollRef.current;
    if (!bounds || !el) return;
    requestAnimationFrame(() => {
      const pad = 80;
      const pageW = width * zoom + 132;
      const pageH = height * zoom + 96;
      const targetX = bounds.cx * zoom + 84 - el.clientWidth / 2;
      const targetY = bounds.cy * zoom + 48 - el.clientHeight / 2;
      el.scrollLeft = Math.max(0, Math.min(targetX, pageW - el.clientWidth));
      el.scrollTop = Math.max(0, Math.min(targetY, pageH - el.clientHeight));
    });
  }, [mode, objects, width, height, zoom, graphicId]);

  if (mode === '3d') {
    const hasWorld = worldCount > 0;
    const cam = camera === 'flat' ? 'orbit' : camera;
    return (
      <div className="ec-scroll ec-scroll-3d ec-unified-3d" ref={stageRef}>
        <div
          className="ec-3d-viewport-wrap"
          style={{ width: stage.w, height: stage.h, display: 'grid', placeItems: 'center' }}
        >
          <div style={{ width: width * zoom, height: height * zoom }}>
            <UnifiedViewport
              mode="editor"
              width={width}
              height={height}
              cameraPreset={cam}
              objects={objects}
              backgroundColor={backgroundColor}
              canvasZoom={zoom}
              diagramPointerActive={placing || panning || Boolean(selectedId)}
              selectedObjectId={selectedId}
              onSelectObject={onSelect}
              onUpdateObject={onMutate}
              className="ge-unified-vp"
            >
              <div
                ref={pageRef}
                className="ec-page ec-page-3d-companion"
                style={{ width, height, position: 'relative', background: 'transparent' }}
                onPointerDown={runMode ? undefined : onPagePointerDown}
              >
                <DiagramLayer
                  width={width}
                  height={height}
                  objects={diagramObjects}
                  backgroundColor="transparent"
                  backgroundImage={null}
                  activeFloor={activeFloor}
                  currentValues={runtimeActive ? currentValues : []}
                  alarms={runtimeActive ? alarms : []}
                  fetchTrend={fetchTrend}
                  runtimeMode={runtimeActive}
                  interactive={runMode}
                  animate={runMode}
                  onWriteTag={runMode ? onWriteTag : undefined}
                  onNavigate={runtimeActive ? onNavigate : undefined}
                  resolveAssetRef={resolveAssetRef}
                />
                {!runMode ? renderInteraction(diagramObjects) : null}
              </div>
            </UnifiedViewport>
          </div>
        </div>
        <div className="ec-3d-hint">
          {diagramObjects.length > 0 && hasWorld
            ? `3D + SCADA (${diagramObjects.length} widgets) — แก้ไข overlay ใช้ 2D`
            : diagramObjects.length > 0
              ? `SCADA overlay ${diagramObjects.length} ชิ้น`
              : hasWorld
                ? '3D View — ลากหมุน · สกอลล์ซูม'
                : 'ยังไม่มีวัตถุ — วาง widget จากแถบซ้าย · 3D ใช้ Import HTML/GLB'}
        </div>
      </div>
    );
  }

  return (
    <div className={`ec-scroll${panning ? ' ec-panning' : ''}`} ref={scrollRef} onDragOver={onCanvasDragOver} onDrop={onCanvasDrop}>
      <div className="ec-page-wrap" style={{ width: width * zoom, height: height * zoom }}>
        <div
          ref={pageRef}
          className={`ec-page${htmlLayout ? ' ec-page-html' : ''}${htmlFocus === 'html' ? ' ec-html-explore' : ''}${htmlFocus === 'widgets' && htmlLayout ? ' ec-html-widgets' : ''}${placing && widgetEditing && !runMode ? ' ec-placing' : ''}${runMode ? ' ec-run-mode' : ''}`}
          style={{
            width,
            height,
            transform: `scale(${zoom})`,
            backgroundColor: htmlLayout ? 'transparent' : backgroundColor,
            position: 'relative',
          }}
          onPointerDown={runMode || (isHtmlComposite && !widgetEditing) ? undefined : onPagePointerDown}
        >
          {htmlLayout ? (
            <div className="ec-html-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: htmlInteractive ? 'auto' : 'none' }}>
              <HtmlGraphicPage
                layout={htmlLayout}
                width={width}
                height={height}
                currentValues={runtimeActive ? currentValues : []}
                resolveAssetRef={resolveAssetRef}
                onWriteTag={runMode ? onWriteTag : undefined}
                interactive={htmlInteractive}
                className="ec-html-bg-inner"
                onAnchorsChange={onHtmlAnchorsChange}
              />
            </div>
          ) : null}

          {showAnchorDots && htmlAnchors.size > 0 ? (
            <div className="ec-html-anchors">
              {[...htmlAnchors.values()].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`ec-html-anchor-dot${boundAnchorIds.has(a.id) ? ' bound' : ''}`}
                  style={{ left: a.x, top: a.y }}
                  title={`${a.label ?? a.id}${boundAnchorIds.has(a.id) ? ' (ผูกแล้ว)' : ' — คลิกเพื่อผูก widget'}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (widgetEditing) onAnchorPick?.(a);
                  }}
                >
                  <span className="ec-html-anchor-label">{a.label ?? a.id}</span>
                </button>
              ))}
            </div>
          ) : null}

          <DiagramLayer
            width={width}
            height={height}
            objects={displayObjects}
            backgroundColor={htmlLayout ? 'transparent' : (backgroundImage ? 'transparent' : backgroundColor)}
            backgroundImage={htmlLayout ? null : (backgroundImage ?? null)}
            activeFloor={activeFloor}
            currentValues={runtimeActive ? currentValues : []}
            alarms={runtimeActive ? alarms : []}
            fetchTrend={fetchTrend}
            runtimeMode={runtimeActive}
            interactive={runMode}
            pointerPassthrough={isHtmlComposite}
            animate={runMode}
            onWriteTag={runMode ? onWriteTag : undefined}
            onNavigate={runtimeActive ? onNavigate : undefined}
            resolveAssetRef={resolveAssetRef}
            className={htmlLayout ? 'ec-html-overlay' : undefined}
          />

          {gridEnabled && widgetEditing && !runMode ? (
            <EditorGridOverlay size={gridSize} style={gridStyle} />
          ) : null}

          {widgetEditing && !runMode ? renderInteraction(displayObjects) : null}
        </div>
      </div>
    </div>
  );
}
