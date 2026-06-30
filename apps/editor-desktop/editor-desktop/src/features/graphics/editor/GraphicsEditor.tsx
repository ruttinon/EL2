import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderOpen, PlusSquare, Trash2, SquarePen, Box, MinusCircle, PlusCircle,
  Magnet, Save, ImagePlus, Activity, Play, Pencil, Layers, FileCode, Upload, Boxes,
} from 'lucide-react';
import type { WriteTagOptions } from '@energylink/graphics-runtime';
import {
  createWireObject,
  parsePorts,
  collectFloorLevels,
  GraphicNavigationBar,
} from '@energylink/graphics-runtime';
import type { UnifiedCameraPreset, GraphicObjectDefinition } from '@energylink/shared-types';
import { isHtmlGraphicPage, isGlbBuildingGraphic } from '@energylink/shared-types';
import type { CurrentTagValue, RuntimeAlarm, HtmlAnchorMap, HtmlAnchorPosition } from '@energylink/graphics-runtime';
import { nearestHtmlAnchor } from '@energylink/graphics-runtime';
import { EDITOR_COMMAND_EVENT, normalizeCommand, type EditorCommand } from '../../../commandBus';
import { editorRuntimeApi, subscribeTagValues } from '../../../api/editorRuntimeApi';
import { useGraphicDoc } from './useGraphicDoc';
import { type ActiveTool } from './ToolRail';
import { EditorLeftDock } from './EditorLeftDock';
import { EditorCanvas } from './EditorCanvas';
import { InspectorPanel } from './InspectorPanel';
import { makeObject, makeSymbolObject, makeGroupObject, findTool, toolLabel } from './objectCatalog';
import { makeImageFromDevice } from '../deviceAssetHelpers';
import { ScreenTemplateId, SCREEN_TEMPLATES, getTemplateInitialObjects } from './scadaPresets';
import { importModelFileToAsset, buildExternalPageFromHtmlFile, resolveAssetRef, loadGraphicAssets } from '../graphicAssets';
import { parseDeviceToolKey } from './DevicePalette';
import { importSvgToLibrary } from '../graphicSymbols';
import { resolveGraphicsToolCommand } from './graphicsEditorCommands';
import { validateGraphic, type ValidationIssue } from './GraphicValidation';
import { buildWallFromPoints, appendPathPoint } from './sceneBuilderPlacement';
import { objectsFromSceneCatalogPayload } from './sceneCatalogPlacement';
import type { SceneCatalogDropPayload } from '../GraphicsSceneCatalog';
import type { CatalogStripCategory } from '../components/GraphicSceneCatalogStrip';
import type { SceneCatalogImage } from '../GraphicsSceneCatalog';
import { EditorGridControls } from '../../EditorGridControls';
import {
  DEFAULT_GRID_SIZE,
  isGridCommand,
  normalizeGridSize,
  parseGridSizeFromCommand,
  type EditorGridStyle,
} from '../../editorGrid';

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function GraphicsEditor() {
  const doc = useGraphicDoc();
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const handleSelect = useCallback((id: string | null, opts?: { additive?: boolean }) => {
    if (!id) {
      setSelectedIds([]);
      return;
    }
    if (opts?.additive) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      return;
    }
    setSelectedIds([id]);
  }, []);
  const [zoom, setZoom] = useState(1);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [gridStyle, setGridStyle] = useState<EditorGridStyle>('lines');
  const [snap, setSnap] = useState(true);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [livePreview, setLivePreview] = useState(false);
  const [runMode, setRunMode] = useState(false);
  const [htmlExplore, setHtmlExplore] = useState(false);
  const [liveValues, setLiveValues] = useState<CurrentTagValue[]>([]);
  const [liveAlarms, setLiveAlarms] = useState<RuntimeAlarm[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('New Graphic');
  const [newW, setNewW] = useState(1366);
  const [newH, setNewH] = useState(768);
  const [newTemplate, setNewTemplate] = useState<ScreenTemplateId>('blank');
  const [editorUiMode, setEditorUiMode] = useState<'simple' | 'advanced' | 'building'>(() => {
    return (localStorage.getItem('energylink:editor-ui-mode') as any) || 'simple';
  });
  const changeUiMode = (newMode: 'simple' | 'advanced' | 'building') => {
    setEditorUiMode(newMode);
    localStorage.setItem('energylink:editor-ui-mode', newMode);
  };
  const [validationOpen, setValidationOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState<CatalogStripCategory>('equipment');
  const [armedCatalogPayload, setArmedCatalogPayload] = useState<{
    id: string;
    payload: SceneCatalogDropPayload;
    label: string;
  } | null>(null);
  const [safetyWriteModal, setSafetyWriteModal] = useState<{
    isOpen: boolean;
    tagId: string;
    targetValue: any;
    options?: WriteTagOptions;
    confirmReason: string;
    checkedInterlock: boolean;
    checkedConfirm: boolean;
    status: 'idle' | 'writing' | 'success' | 'error';
    statusText: string;
  } | null>(null);
  const [armedCatalogToolId, setArmedCatalogToolId] = useState<string | null>(null);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [pathEditId, setPathEditId] = useState<string | null>(null);
  const [catalogImages, setCatalogImages] = useState<SceneCatalogImage[]>([]);
  const promptedCreateRef = useRef(false);
  const htmlImportRef = useRef<HTMLInputElement>(null);
  const htmlReplaceRef = useRef<HTMLInputElement>(null);
  const glbImportRef = useRef<HTMLInputElement>(null);
  const glbReplaceRef = useRef<HTMLInputElement>(null);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [htmlAnchors, setHtmlAnchors] = useState<HtmlAnchorMap>(() => new Map());

  const g = doc.selected;
  const isHtmlPage = g ? isHtmlGraphicPage(g.layout) : false;
  const htmlFocus: 'widgets' | 'html' | 'run' = runMode ? 'run' : htmlExplore ? 'html' : 'widgets';
  const width = g?.width ?? 1366;
  const height = g?.height ?? 768;
  const validationIssues = useMemo(() => {
    if (!g) return [];
    return validateGraphic(doc.objects, width, height, doc.graphics);
  }, [g, doc.objects, width, height, doc.graphics]);
  const isGlbBuilding = g ? isGlbBuildingGraphic(g.layout, width, height) : false;
  const bg = g?.layout.backgroundColor ?? '#0f172a';
  const bgImage = g?.layout.backgroundImage ?? null;
  const camera: UnifiedCameraPreset = g?.layout.defaultCamera ?? 'flat';

  useEffect(() => {
    setHtmlAnchors(new Map());
  }, [doc.selectedId]);

  // ── Task 9: Binding Health ──────────────────────────────────────────────────
  const bindingHealth = useMemo(() => {
    const total = doc.objects.filter((o) =>
      ['value', 'gauge', 'kpicard', 'trend', 'alarmtable', 'elecsymbol', 'switch', 'button'].includes(o.type)
    );
    const bound = total.filter((o) => (o.tagId ?? o.binding?.tagId));
    return { total: total.length, bound: bound.length, unbound: total.length - bound.length };
  }, [doc.objects]);

  const [auditLog, setAuditLog] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('energylink:hmi-audit-log') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const onAuditChange = () => {
      try {
        setAuditLog(JSON.parse(localStorage.getItem('energylink:hmi-audit-log') || '[]'));
      } catch {
        setAuditLog([]);
      }
    };
    window.addEventListener('energylink:hmi-audit-log-changed', onAuditChange);
    return () => window.removeEventListener('energylink:hmi-audit-log-changed', onAuditChange);
  }, []);

  const [showAuditLog, setShowAuditLog] = useState(false);
  // ────────────────────────────────────────────────────────────────────────────

  const bindPlacedToHtmlAnchor = useCallback(
    (obj: GraphicObjectDefinition, x: number, y: number): GraphicObjectDefinition => {
      if (!isHtmlPage || htmlAnchors.size === 0) return obj;
      const cx = x + obj.width / 2;
      const cy = y + obj.height / 2;
      const anchor = nearestHtmlAnchor(htmlAnchors, cx, cy);
      if (!anchor) return obj;
      return {
        ...obj,
        style: {
          ...obj.style,
          anchorId: anchor.id,
          anchorOffsetX: Math.round(cx - anchor.x),
          anchorOffsetY: Math.round(cy - anchor.y),
        },
      };
    },
    [isHtmlPage, htmlAnchors],
  );

  const selectedObject = useMemo(
    () => doc.objects.find((o) => o.id === selectedId) ?? null,
    [doc.objects, selectedId],
  );

  const handleImportHtmlPage = useCallback(async (file?: File | null, replace = false) => {
    if (!file) return;
    try {
      const externalPage = await buildExternalPageFromHtmlFile(file);
      if (replace && doc.selectedId && isHtmlGraphicPage(doc.selected?.layout)) {
        await doc.replaceHtmlGraphic({ sandbox: 'strict', ...externalPage });
        return;
      }
      const baseName = file.name.replace(/\.html?$/i, '') || 'HTML Page';
      await doc.createHtmlGraphic(baseName, 1366, 768, { sandbox: 'strict', ...externalPage });
    } catch {
      doc.setNotice({ kind: 'error', text: 'ไม่สามารถ import HTML ได้' });
    }
  }, [doc]);

  const handleImportGlbBuilding = useCallback(async (file?: File | null, replace = false) => {
    if (!file) return;
    try {
      const { url } = await importModelFileToAsset(file);
      const baseName = file.name.replace(/\.(glb|gltf)$/i, '') || 'GLB Building';
      if (replace && doc.selectedId && doc.selected && isGlbBuildingGraphic(doc.selected.layout, doc.selected.width, doc.selected.height)) {
        await doc.replaceGlbBuildingGraphic(url);
        return;
      }
      await doc.createGlbBuildingGraphic(baseName, 1366, 768, url);
    } catch {
      doc.setNotice({ kind: 'error', text: 'ไม่สามารถ import GLB building ได้' });
    }
  }, [doc]);

  const graphicIdRef = useRef<string | null>(null);
  // Keep a valid selection; when switching graphics pick the topmost layer object
  useEffect(() => {
    const graphicChanged = graphicIdRef.current !== doc.selectedId;
    graphicIdRef.current = doc.selectedId;
    if (doc.objects.length === 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      const kept = prev.filter((id) => doc.objects.some((o) => o.id === id));
      if (!graphicChanged && kept.length > 0) return kept;
      const top = [...doc.objects].sort((a, b) => (b.layer ?? 0) - (a.layer ?? 0))[0];
      return top ? [top.id] : [];
    });
  }, [doc.selectedId, doc.objects]);

  useEffect(() => {
    if (isHtmlPage && mode !== '2d') setMode('2d');
  }, [isHtmlPage, mode]);

  useEffect(() => {
    if (isGlbBuilding) setMode('3d');
    else if (!isHtmlPage && mode === '3d') setMode('2d');
  }, [doc.selectedId, isGlbBuilding, isHtmlPage, mode]);

  useEffect(() => {
    setActiveFloor(null);
  }, [doc.selectedId]);

  const floorLevels = useMemo(() => collectFloorLevels(doc.objects), [doc.objects]);

  useEffect(() => {
    if (!isHtmlPage) {
      setHtmlExplore(false);
    }
  }, [isHtmlPage]);

  const placing = !runMode && !htmlExplore && (
    (activeTool !== 'select' && activeTool !== 'pan') || Boolean(armedCatalogPayload) || Boolean(pathEditId)
  );

  const disarmCatalog = useCallback(() => {
    setArmedCatalogPayload(null);
    setArmedCatalogToolId(null);
  }, []);

  const pickTool = useCallback(
    (tool: ActiveTool) => {
      disarmCatalog();
      setPathEditId(null);
      setWallStart(null);
      setMeasurePoints([]);
      if (!doc.selectedId && tool !== 'select' && tool !== 'pan') {
        doc.setNotice({ kind: 'error', text: 'สร้างหรือเลือกกราฟิกก่อนวาง widget' });
        return;
      }
      if (tool === 'group') {
        doc.setNotice({ kind: 'success', text: 'Group: คลิก canvas วางกล่องกลุ่ม หรือ Ctrl+G รวมที่เลือก' });
      }
      setActiveTool(tool);
    },
    [disarmCatalog, doc, doc.selectedId],
  );

  const armCatalogTool = useCallback(
    (id: string, tool: string, label: string) => {
      setArmedCatalogPayload(null);
      setArmedCatalogToolId(id);
      if (tool === 'measure') {
        setMeasurePoints([]);
        doc.setNotice({ kind: 'success', text: 'Measure — คลิก 2 จุดบน canvas' });
        return;
      }
      const mapped = tool === 'wire' ? 'flowpath' : tool;
      if (!findTool(mapped)) {
        doc.setNotice({ kind: 'error', text: `เครื่องมือ ${label} ยังไม่รองรับ` });
        return;
      }
      setActiveTool(mapped);
      doc.setNotice({
        kind: 'success',
        text: `${label} — คลิกบน canvas · Esc ยกเลิก`,
      });
    },
    [doc],
  );

  const refreshCatalogAssets = useCallback(() => {
    const assets = loadGraphicAssets();
    setCatalogImages(
      assets
        .filter((a) => a.kind === 'image')
        .map((a) => ({ id: a.id, name: a.name, dataUrl: a.url })),
    );
  }, []);

  useEffect(() => {
    refreshCatalogAssets();
  }, [doc.selectedId, refreshCatalogAssets]);

  useEffect(() => {
    if (!doc.ready || !doc.hasProject || doc.busy) return;
    if (doc.graphics.length === 0 && !showNew && !promptedCreateRef.current) {
      promptedCreateRef.current = true;
      setShowNew(true);
      doc.setNotice({ kind: 'success', text: 'สร้างกราฟิกแรกเพื่อเริ่มวาง widget / อุปกรณ์บน canvas' });
    }
    if (doc.graphics.length > 0) promptedCreateRef.current = false;
  }, [doc.ready, doc.hasProject, doc.graphics.length, doc.busy, showNew, doc]);

  const zTop = useMemo(() => doc.objects.reduce((m, o) => Math.max(m, o.layer ?? 0), 0), [doc.objects]);

  const handlePlace = useCallback(
    (x: number, y: number) => {
      if (!placing && !pathEditId) return;

      if (pathEditId) {
        const target = doc.objects.find((o) => o.id === pathEditId);
        if (!target || (target.type !== 'flowpath' && target.type !== 'pipe' && target.type !== 'cable3d')) {
          setPathEditId(null);
          return;
        }
        const next = appendPathPoint(target, x, y);
        doc.updateObject(pathEditId, { style: { ...target.style, pathPoints: next } });
        doc.setNotice({ kind: 'success', text: 'เพิ่มจุด path — Enter เสร็จ · Esc ยกเลิก' });
        return;
      }

      if (activeTool === 'measure') {
        const next = [...measurePoints, { x, y }];
        if (next.length < 2) {
          setMeasurePoints(next);
          doc.setNotice({ kind: 'success', text: 'Measure — คลิกจุดที่สอง' });
          return;
        }
        const dist = Math.round(Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y));
        doc.setNotice({ kind: 'success', text: `ระยะทาง: ${dist} px` });
        setMeasurePoints([]);
        setActiveTool('select');
        return;
      }

      if (activeTool === 'wall') {
        if (!wallStart) {
          setWallStart({ x, y });
          doc.setNotice({ kind: 'success', text: 'ผนัง — คลิกจุดจบ · Esc ยกเลิก' });
          return;
        }
        const obj = buildWallFromPoints(wallStart, { x, y }, zTop);
        doc.addObject(obj);
        handleSelect(obj.id);
        setWallStart({ x: obj.style?.wallEndX as number ?? x, y: obj.style?.wallEndY as number ?? y });
        doc.setNotice({ kind: 'success', text: `ผนัง ${Math.round(obj.width)}px — คลิกต่อหรือ Esc หยุด` });
        return;
      }

      if (armedCatalogPayload) {
        const placed = objectsFromSceneCatalogPayload(armedCatalogPayload.payload, x, y, {
          graphicWidth: width,
          graphicHeight: height,
          mmPerPx: g?.layout?.sceneScaleMmPerPx,
          zTop,
        });
        placed.forEach((o) => doc.addObject(bindPlacedToHtmlAnchor(o, o.x, o.y)));
        handleSelect(placed[0]?.id ?? null);
        disarmCatalog();
        setActiveTool('select');
        return;
      }

      const deviceKey = parseDeviceToolKey(activeTool);
      if (deviceKey) {
        const device = doc.devices.find((d) => d.id === deviceKey.deviceId);
        if (!device) {
          doc.setNotice({ kind: 'error', text: 'Device not found.' });
          return;
        }
        const partial = makeImageFromDevice(device, x, y);
        if (!partial) {
          doc.setNotice({ kind: 'error', text: `${device.name}: ไม่มีรูป 2D — อัปโหลดใน Devices` });
          return;
        }
        const obj = makeObject('image', x, y, zTop);
        const primaryTag = doc.tags.find((t) => (t.deviceId ?? t.device_id) === device.id)?.id;
        Object.assign(obj, partial, {
          tagId: primaryTag ?? partial.tagId,
          style: {
            ...obj.style,
            ...partial.style,
            ...(primaryTag ? { showValueOverlay: true } : {}),
          },
        });
        doc.addObject(bindPlacedToHtmlAnchor(obj, x, y));
        handleSelect(obj.id);
        setActiveTool('select');
        return;
      }

      try {
        const obj = bindPlacedToHtmlAnchor(makeObject(activeTool, x, y, zTop), x, y);
        doc.addObject(obj);
        handleSelect(obj.id);
        setActiveTool('select');
      } catch {
        doc.setNotice({ kind: 'error', text: `เครื่องมือ "${activeTool}" ยังวางไม่ได้` });
        setActiveTool('select');
      }
    },
    [activeTool, placing, zTop, doc, armedCatalogPayload, width, height, g?.layout?.sceneScaleMmPerPx, disarmCatalog, bindPlacedToHtmlAnchor, pathEditId, measurePoints, wallStart, handleSelect],
  );

  const startPathEdit = useCallback((objectId: string) => {
    const obj = doc.objects.find((o) => o.id === objectId);
    if (!obj || (obj.type !== 'flowpath' && obj.type !== 'pipe' && obj.type !== 'cable3d')) return;
    setPathEditId(objectId);
    setActiveTool('select');
    setWallStart(null);
    setMeasurePoints([]);
    doc.setNotice({ kind: 'success', text: 'แก้ path — คลิกเพิ่มจุด · Enter เสร็จ · Esc ยกเลิก' });
  }, [doc]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pathEditId) {
          setPathEditId(null);
          doc.setNotice({ kind: 'success', text: 'ยกเลิกแก้ path' });
        } else if (wallStart) {
          setWallStart(null);
          setActiveTool('select');
          doc.setNotice({ kind: 'success', text: 'ยกเลิกวาดผนัง' });
        } else if (measurePoints.length) {
          setMeasurePoints([]);
          setActiveTool('select');
        }
      }
      if (event.key === 'Enter' && pathEditId) {
        setPathEditId(null);
        doc.setNotice({ kind: 'success', text: 'บันทึก path แล้ว' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathEditId, wallStart, measurePoints.length, doc]);

  const handleAnchorPick = useCallback(
    (anchor: HtmlAnchorPosition) => {
      if (placing) {
        handlePlace(anchor.x - 50, anchor.y - 20);
        doc.setNotice({ kind: 'success', text: `วางที่จุดยึด "${anchor.label ?? anchor.id}"` });
        return;
      }
      if (selectedObject) {
        const cx = selectedObject.x + selectedObject.width / 2;
        const cy = selectedObject.y + selectedObject.height / 2;
        doc.updateObject(selectedObject.id, {
          style: {
            ...selectedObject.style,
            anchorId: anchor.id,
            anchorOffsetX: Math.round(cx - anchor.x),
            anchorOffsetY: Math.round(cy - anchor.y),
          },
        });
        doc.setNotice({ kind: 'success', text: `ผูก "${selectedObject.name ?? selectedObject.type}" กับ "${anchor.label ?? anchor.id}"` });
        return;
      }
      doc.setNotice({ kind: 'success', text: `ผูก "${anchor.label ?? anchor.id}"` });
    },
    [placing, handlePlace, selectedObject, doc],
  );

  const handleDropFiles = useCallback(
    async (files: FileList, x: number, y: number) => {
      const file = files[0];
      if (!file || !doc.selectedId) return;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
        doc.setNotice({ kind: 'error', text: 'โมเดล 3D ใช้ Import GLB (หน้าเต็มจอ) — ไม่วางบน canvas' });
        return;
      }
      if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
        try {
          const sym = await importSvgToLibrary(file);
          const obj = makeSymbolObject(sym.id, x, y, zTop);
          doc.addObject(obj);
          handleSelect(obj.id);
        } catch {
          doc.setNotice({ kind: 'error', text: 'ไฟล์ SVG ไม่ถูกต้อง' });
        }
        return;
      }
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result);
          const obj = makeObject('image', x, y, zTop);
          obj.imageDataUrl = dataUrl;
          obj.style = { ...obj.style, imageDataUrl: dataUrl, objectFit: 'contain' };
          doc.addObject(obj);
          handleSelect(obj.id);
        };
        reader.readAsDataURL(file);
      }
    },
    [doc, zTop],
  );

  const logHmiAudit = useCallback((tagId: string, value: any, reason: string) => {
    try {
      const log = JSON.parse(localStorage.getItem('energylink:hmi-audit-log') || '[]');
      const newEntry = {
        timestamp: new Date().toISOString(),
        tagId,
        value,
        reason,
        user: 'operator',
      };
      log.unshift(newEntry);
      localStorage.setItem('energylink:hmi-audit-log', JSON.stringify(log.slice(0, 100)));
      window.dispatchEvent(new Event('energylink:hmi-audit-log-changed'));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleWriteTag = useCallback(
    async (
      tagId: string,
      _tagName: string,
      dataType: string,
      options?: WriteTagOptions,
    ) => {
      const isBool = dataType === 'bool';
      let value: number | boolean;
      if (options?.presetValue !== undefined) {
        const pv = options.presetValue;
        value = typeof pv === 'string' ? (isBool ? pv === 'true' || pv === '1' : Number(pv)) : pv;
        if (typeof value === 'number' && !Number.isFinite(value)) return;
      } else if (isBool) {
        value = true;
      } else {
        const raw = window.prompt(`Write value to ${tagId}:`, '0');
        if (raw === null) return;
        value = Number(raw);
        if (!Number.isFinite(value)) return;
      }

      const needsSafetyPrompt = editorUiMode === 'simple' || options?.requireConfirm;

      if (needsSafetyPrompt) {
        setSafetyWriteModal({
          isOpen: true,
          tagId,
          targetValue: value,
          options,
          confirmReason: '',
          checkedInterlock: false,
          checkedConfirm: false,
          status: 'idle',
          statusText: '',
        });
      } else {
        const res = await editorRuntimeApi.writeTag(tagId, value);
        if (!res.ok) {
          doc.setNotice({ kind: 'error', text: res.message });
        } else {
          doc.setNotice({ kind: 'success', text: `Write ${tagId} = ${value} success` });
          logHmiAudit(tagId, value, 'Direct Command');
        }
      }
    },
    [doc, editorUiMode, logHmiAudit],
  );

  const toggleRunMode = useCallback(() => {
    setRunMode((v) => {
      const next = !v;
      if (next) {
        setHtmlExplore(false);
        setActiveTool('select');
        setSelectedIds([]);
        setLivePreview(true);
      }
      return next;
    });
  }, []);

  const placingLabel = useMemo(() => {
    if (pathEditId) return 'แก้จุดเส้น (path)';
    if (armedCatalogPayload) return armedCatalogPayload.label;
    if (activeTool === 'wall' && wallStart) return 'ผนัง — คลิกจุดจบ';
    if (activeTool === 'measure' && measurePoints.length) return 'วัดระยะ — จุดที่สอง';
    if (activeTool === 'select' || activeTool === 'pan') return null;
    return toolLabel(activeTool);
  }, [pathEditId, armedCatalogPayload, activeTool, wallStart, measurePoints.length]);

  const reorder = useCallback(
    (id: string, dir: 'front' | 'back') => {
      const layers = doc.objects.map((o) => o.layer ?? 0);
      const max = Math.max(0, ...layers);
      const min = Math.min(0, ...layers);
      doc.updateObject(id, { layer: dir === 'front' ? max + 1 : min - 1 });
    },
    [doc],
  );

  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach((id) => doc.removeObject(id));
    setSelectedIds([]);
  }, [selectedIds, doc]);

  const groupSelection = useCallback(() => {
    const memberIds = selectedIds.filter((id) => {
      const o = doc.objects.find((x) => x.id === id);
      return o && o.type !== 'group';
    });
    if (memberIds.length < 2) {
      doc.setNotice({ kind: 'error', text: 'เลือกอย่างน้อย 2 อ็อบเจกต์ (Ctrl+คลิก)' });
      return;
    }
    const members = doc.objects.filter((o) => memberIds.includes(o.id));
    const minX = Math.min(...members.map((m) => m.x));
    const minY = Math.min(...members.map((m) => m.y));
    const maxX = Math.max(...members.map((m) => m.x + m.width));
    const maxY = Math.max(...members.map((m) => m.y + m.height));
    const pad = 2;
    const group = makeGroupObject(
      minX - pad,
      minY - pad,
      maxX - minX + pad * 2,
      maxY - minY + pad * 2,
      memberIds,
      zTop,
      `Group_${memberIds.length}`,
    );
    doc.addObject(group);
    handleSelect(group.id);
    doc.setNotice({ kind: 'success', text: `รวม Group ${memberIds.length} ชิ้น` });
  }, [selectedIds, doc, zTop, handleSelect]);

  const ungroupGroup = useCallback(
    (groupId: string) => {
      const group = doc.objects.find((o) => o.id === groupId);
      if (!group || group.type !== 'group') return;
      doc.removeObject(groupId);
      setSelectedIds([]);
      doc.setNotice({ kind: 'success', text: 'ลบ Group แล้ว (อ็อบเจกต์ข้างในยังอยู่)' });
    },
    [doc],
  );

  const autoRouteEquipment = useCallback(() => {
    const equip = doc.objects.filter(
      (o) => o.visible !== false && o.type === 'elecsymbol',
    );
    const order = ['transformer', 'solar', 'mdb', 'meter', 'breaker', 'motor', 'generator', 'ups', 'load'];
    const score = (o: typeof equip[0]) => {
      const key = `${o.style?.symbolId ?? ''} ${o.name ?? ''}`.toLowerCase();
      const idx = order.findIndex((k) => key.includes(k));
      return idx === -1 ? 99 : idx;
    };
    const sorted = [...equip].sort((a, b) => score(a) - score(b));
    if (sorted.length < 2) {
      doc.setNotice({ kind: 'error', text: 'ต้องมีสัญลักษณ์อุปกรณ์ (Elec Symbol) อย่างน้อย 2 ชิ้นบน canvas' });
      return;
    }
    let linked = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i];
      const to = sorted[i + 1];
      const fromPorts = parsePorts(from.style?.ports);
      const toPorts = parsePorts(to.style?.ports);
      const outPort = fromPorts.find((p) => p.kind === 'out') ?? fromPorts[fromPorts.length - 1];
      const inPort = toPorts.find((p) => p.kind === 'in') ?? toPorts[0];
      if (!outPort || !inPort) continue;
      try {
        const wireId = `flowpath_${Date.now()}_${i}`;
        const wire = createWireObject(from, outPort.id, to, inPort.id, wireId, `Wire ${from.name}-${to.name}`);
        doc.addObject(wire);
        linked++;
      } catch {
        /* skip pair without valid ports */
      }
    }
    doc.setNotice({
      kind: linked > 0 ? 'success' : 'error',
      text: linked > 0 ? `Auto Route: เชื่อม ${linked} คู่อุปกรณ์` : 'ไม่พบ port ที่เชื่อมได้ — ใช้ Elec Symbol ที่มี port',
    });
  }, [doc]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void doc.saveGraphic();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (doc.canUndo) doc.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (doc.canRedo) doc.redo();
        return;
      }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        groupSelection();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
      if (e.key === 'Escape') {
        disarmCatalog();
        setActiveTool('select');
        setSelectedIds([]);
        return;
      }
      if (e.key === 'v' || e.key === 'V') pickTool('select');
      if (e.key === 'h' || e.key === 'H') pickTool('pan');
      if (selectedId && selectedObject) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') { e.preventDefault(); doc.updateObject(selectedId, { x: selectedObject.x - step }); }
        if (e.key === 'ArrowRight') { e.preventDefault(); doc.updateObject(selectedId, { x: selectedObject.x + step }); }
        if (e.key === 'ArrowUp') { e.preventDefault(); doc.updateObject(selectedId, { y: selectedObject.y - step }); }
        if (e.key === 'ArrowDown') { e.preventDefault(); doc.updateObject(selectedId, { y: selectedObject.y + step }); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, removeSelected, selectedId, selectedObject, pickTool, disarmCatalog, groupSelection]);

  // ── Task 10: Auto-save debounce ─────────────────────────────────────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!doc.dirty || !doc.selectedId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void doc.saveGraphic();
    }, 2500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [doc.dirty, doc.selectedId, doc.objects]);
  // ────────────────────────────────────────────────────────────────────────────

  const bindFirstTag = useCallback(() => {
    if (!selectedId || !selectedObject) {
      doc.setNotice({ kind: 'error', text: 'เลือก object บน canvas ก่อน Bind Tag' });
      return;
    }
    const deviceId = selectedObject.deviceId;
    const tag = doc.tags.find((t) => (t.deviceId ?? t.device_id) === deviceId)
      ?? doc.tags.find((t) => !deviceId)
      ?? doc.tags[0];
    if (!tag) {
      doc.setNotice({ kind: 'error', text: 'ยังไม่มี tag — สร้างใน Setup → Tags' });
      return;
    }
    doc.updateObject(selectedId, { tagId: tag.id, deviceId: tag.deviceId ?? tag.device_id ?? deviceId });
    doc.setNotice({ kind: 'success', text: `ผูก tag: ${tag.name ?? tag.id}` });
  }, [selectedId, selectedObject, doc]);

  // command bus (ribbon + left panel)
  useEffect(() => {
    const onCmd = (e: Event) => {
      const detail = (e as CustomEvent<EditorCommand>).detail;
      if (!detail || detail.module !== 'graphics') return;
      const cmd = normalizeCommand(detail.item);

      if (cmd === 'save') void doc.saveGraphic();
      else if (cmd === 'new graphic') setShowNew(true);
      else if (isGridCommand(cmd)) {
        const parsedSize = parseGridSizeFromCommand(cmd);
        if (parsedSize != null) setGridSize(parsedSize);
        setGridEnabled((v) => {
          const next = !v;
          doc.setNotice({
            kind: 'success',
            text: `Grid ${normalizeGridSize(parsedSize ?? gridSize)}px ${next ? 'On' : 'Off'}`,
          });
          return next;
        });
      }
      else if (cmd === 'snap 3d') {
        doc.setNotice({ kind: 'success', text: 'Snap 3D toggled' });
      }
      else if (cmd === 'wall tool') {
        disarmCatalog();
        pickTool('wall');
        doc.setNotice({ kind: 'success', text: 'Wall Tool — click to start drawing' });
      }
      else if (cmd === 'measure') {
        disarmCatalog();
        pickTool('measure');
        doc.setNotice({ kind: 'success', text: 'Measure — click two points' });
      }
      else if (cmd === 'zoom') setZoom((z) => ZOOM_LEVELS[(ZOOM_LEVELS.indexOf(z) + 1) % ZOOM_LEVELS.length]);
      else if (cmd === 'zoom fit') setZoom(1);
      else if (cmd === 'designer' || cmd === 'graphics list') void doc.reload();
      else if (cmd === 'delete') {
        if (selectedId) removeSelected();
        else if (doc.selectedId) void doc.deleteGraphic(doc.selectedId);
      }
      else if (cmd === 'preview') {
        if (mode !== '2d') setMode('2d');
        toggleRunMode();
      }
      else if (cmd === 'validate') {
        // Count unbound objects and show summary
        const unbound = doc.objects.filter((o) => !['group', 'text', 'image', 'rectangle', 'circle', 'line', 'polygon', 'hotspot'].includes(o.type) && !o.tagId);
        if (unbound.length === 0) {
          doc.setNotice({ kind: 'success', text: `Validate OK — all ${doc.objects.length} objects are bound` });
        } else {
          doc.setNotice({ kind: 'error', text: `Validate: ${unbound.length} object(s) have no tag binding` });
        }
      }
      else if (cmd === 'bind tag') bindFirstTag();
      else if (cmd === 'lock') {
        if (!selectedId || !selectedObject) {
          doc.setNotice({ kind: 'error', text: 'Select an object first to Lock' });
        } else {
          doc.updateObject(selectedId, { locked: !selectedObject.locked });
          doc.setNotice({ kind: 'success', text: selectedObject.locked ? 'Unlocked' : 'Locked' });
        }
      }
      else if (cmd === 'object tools') {
        disarmCatalog();
        pickTool('text');
      }
      else {
        const tool = resolveGraphicsToolCommand(cmd);
        if (tool) {
          disarmCatalog();
          pickTool(tool);
        }
      }
    };
    window.addEventListener(EDITOR_COMMAND_EVENT, onCmd);
    return () => window.removeEventListener(EDITOR_COMMAND_EVENT, onCmd);
  }, [doc, gridEnabled, gridSize, mode, selectedId, selectedObject, removeSelected, bindFirstTag, toggleRunMode, disarmCatalog, pickTool]);

  // auto dismiss notice
  useEffect(() => {
    if (!doc.notice) return;
    const id = setTimeout(() => doc.setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [doc.notice, doc]);

  // live preview — real tag values from the engine while designing (2D only).
  // Values arrive via SSE push (P3) with automatic fallback to HTTP polling;
  // alarms are light-polled separately.
  useEffect(() => {
    if (!livePreview && !runMode || (mode !== '2d' && !isHtmlPage && !isGlbBuilding) || !doc.selectedId) return undefined;
    let active = true;
    let valuePollTimer: ReturnType<typeof setInterval> | null = null;

    const pollValues = async () => {
      const v = await editorRuntimeApi.getCurrentValues();
      if (active && v.ok) setLiveValues(v.data.values ?? []);
    };
    const startValuePolling = () => {
      if (valuePollTimer || !active) return;
      void pollValues();
      valuePollTimer = setInterval(() => void pollValues(), 1500);
    };

    // Prefer real-time push; fall back to polling if the stream is unavailable.
    const unsubscribe = subscribeTagValues(
      (values) => { if (active) setLiveValues(values); },
      { onError: startValuePolling },
    );

    const pollAlarms = async () => {
      const a = await editorRuntimeApi.getAlarms();
      if (active && a.ok) setLiveAlarms(a.data.alarms ?? []);
    };
    void pollAlarms();
    const alarmTimer = setInterval(() => void pollAlarms(), 5000);

    return () => {
      active = false;
      unsubscribe();
      if (valuePollTimer) clearInterval(valuePollTimer);
      clearInterval(alarmTimer);
    };
  }, [livePreview, runMode, mode, isHtmlPage, isGlbBuilding, doc.selectedId]);

  const zoomOut = () => setZoom((z) => ZOOM_LEVELS[Math.max(0, ZOOM_LEVELS.indexOf(z) - 1)] ?? z);
  const zoomIn = () => setZoom((z) => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(z) + 1)] ?? z);

  const setCamera = (preset: UnifiedCameraPreset) => doc.patchLayout({ defaultCamera: preset });

  if (!doc.ready) {
    return <div className="ge-root ge-center"><div className="ge-loading">Loading…</div></div>;
  }
  if (!doc.hasProject) {
    return (
      <div className="ge-root ge-center">
        <div className="ge-noproject">
          <FolderOpen size={40} color="#f59e0b" />
          <h3>ยังไม่ได้เปิดโปรเจกต์</h3>
          <p>ไปที่แท็บ File เพื่อเปิดหรือสร้างโปรเจกต์ก่อนเริ่มออกแบบกราฟิก</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ge-root">
      {/* Top bar */}
      <div className="ge-topbar">
        <div className="ge-top-left">
          <select
            className="ge-graphic-select"
            value={doc.selectedId ?? ''}
            onChange={(e) => doc.selectGraphic(e.target.value)}
          >
            {doc.graphics.length === 0 ? <option value="">— No graphics —</option> : null}
            {doc.graphics.map((gr) => (
              <option key={gr.id} value={gr.id}>
                {gr.name}{gr.isDefault ? '  ★' : ''}{isHtmlGraphicPage(gr.layout) ? '  [HTML]' : ''}{isGlbBuildingGraphic(gr.layout, gr.width, gr.height) ? '  [GLB]' : ''}
              </option>
            ))}
          </select>
          <button className="ge-icon-btn" title="New canvas graphic" onClick={() => setShowNew(true)}>
            <PlusSquare size={20} color="#10b981" />
          </button>
          <button
            className="ge-icon-btn"
            title="Import HTML as new graphic page"
            onClick={() => htmlImportRef.current?.click()}
          >
            <FileCode size={20} color="#6366f1" />
          </button>
          <button
            className="ge-icon-btn"
            title="Import GLB building as new graphic page"
            onClick={() => glbImportRef.current?.click()}
          >
            <Boxes size={20} color="#0ea5e9" />
          </button>
          <button
            className="ge-icon-btn"
            title="Delete graphic"
            disabled={!doc.selectedId}
            onClick={() => doc.selectedId && doc.deleteGraphic(doc.selectedId)}
          >
            <Trash2 size={20} color="#ef4444" />
          </button>
        </div>

        <div className="ge-top-center">
          {isHtmlPage ? (
            <>
              <span className="ge-html-mode-label">HTML + SCADA Overlay</span>
              <div className="ge-seg ge-seg-sm">
                <button
                  type="button"
                  className={htmlFocus === 'widgets' ? 'active' : ''}
                  onClick={() => { setHtmlExplore(false); setRunMode(false); }}
                  title="จัด widget — ลาก/ย่อขยาย overlay บน HTML"
                >
                  <Layers size={16} /> Widgets
                </button>
                <button
                  type="button"
                  className={htmlFocus === 'html' ? 'active' : ''}
                  onClick={() => { setHtmlExplore(true); setRunMode(false); setSelectedIds([]); }}
                  title="หมุน/ซูม HTML 3D — widget ล็อกชั่วคราว"
                >
                  <Box size={16} /> 3D View
                </button>
              </div>
              <button
                type="button"
                className="ge-icon-btn ge-html-replace"
                title="Replace HTML file"
                onClick={() => htmlReplaceRef.current?.click()}
              >
                <Upload size={16} /> Replace HTML
              </button>
              <div className="ge-zoom">
                <button onClick={zoomOut} title="Zoom out"><MinusCircle size={18} /></button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={zoomIn} title="Zoom in"><PlusCircle size={18} /></button>
                <EditorGridControls
                  variant="icon"
                  enabled={gridEnabled}
                  size={gridSize}
                  style={gridStyle}
                  onEnabledChange={setGridEnabled}
                  onSizeChange={setGridSize}
                  onStyleChange={setGridStyle}
                />
                <button className={snap ? 'active' : ''} onClick={() => setSnap((v) => !v)} title="Snap to grid">
                  <Magnet size={18} />
                </button>
                <button
                  className={`ge-live-btn${livePreview && !runMode ? ' active ge-live-on' : ''}`}
                  onClick={() => !runMode && setLivePreview((v) => !v)}
                  disabled={runMode}
                  title="Live preview — แสดงค่าจริงจาก Engine"
                >
                  <Activity size={16} /> Live
                </button>
                <button
                  className={`ge-run-btn${runMode ? ' active ge-run-on' : ''}`}
                  onClick={toggleRunMode}
                  title="Run mode — ทดสอบ widget + HTML"
                >
                  {runMode ? <Pencil size={16} /> : <Play size={16} />}
                  {runMode ? 'Edit' : 'Run'}
                </button>
              </div>
            </>
          ) : (
          <>
          {isGlbBuilding ? (
            <>
              <span className="ge-html-mode-label">GLB Building</span>
              <button
                type="button"
                className="ge-icon-btn ge-html-replace"
                title="Replace GLB model"
                onClick={() => glbReplaceRef.current?.click()}
              >
                <Upload size={16} /> Replace GLB
              </button>
              <div className="ge-seg">
                <button className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}>
                  <SquarePen size={16} /> 2D Overlay
                </button>
                <button className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>
                  <Box size={16} /> 3D View
                </button>
              </div>
              {mode === '3d' ? (
                <div className="ge-seg ge-seg-sm">
                  <button className={camera === 'top' ? 'active' : ''} onClick={() => setCamera('top')}>Top</button>
                  <button className={camera === 'orbit' || camera === 'flat' ? 'active' : ''} onClick={() => setCamera('orbit')}>Orbit</button>
                </div>
              ) : (
                <div className="ge-zoom">
                  <button onClick={zoomOut} title="Zoom out"><MinusCircle size={18} /></button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button onClick={zoomIn} title="Zoom in"><PlusCircle size={18} /></button>
                  <EditorGridControls
                    variant="icon"
                    enabled={gridEnabled}
                    size={gridSize}
                    style={gridStyle}
                    onEnabledChange={setGridEnabled}
                    onSizeChange={setGridSize}
                    onStyleChange={setGridStyle}
                  />
                  <button className={snap ? 'active' : ''} onClick={() => setSnap((v) => !v)} title="Snap to grid">
                    <Magnet size={18} />
                  </button>
                  {selectedIds.length >= 2 ? (
                    <button
                      type="button"
                      className="ge-group-btn"
                      onClick={groupSelection}
                      title="รวม Group (Ctrl+G)"
                    >
                      <Layers size={16} /> Group ({selectedIds.length})
                    </button>
                  ) : null}
                  <button
                    className={`ge-live-btn${livePreview && !runMode ? ' active ge-live-on' : ''}`}
                    onClick={() => !runMode && setLivePreview((v) => !v)}
                    disabled={runMode}
                    title="Live preview — แสดงค่าจริงจาก Engine ขณะออกแบบ"
                  >
                    <Activity size={16} /> Live
                  </button>
                  <button
                    className={`ge-run-btn${runMode ? ' active ge-run-on' : ''}`}
                    onClick={toggleRunMode}
                    title="Run mode — ทดสอบหน้าจอแบบ Client"
                  >
                    {runMode ? <Pencil size={16} /> : <Play size={16} />}
                    {runMode ? 'Edit' : 'Run'}
                  </button>
                </div>
              )}
            </>
          ) : (
          <div className="ge-zoom">
            <button onClick={zoomOut} title="Zoom out"><MinusCircle size={18} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} title="Zoom in"><PlusCircle size={18} /></button>
            <EditorGridControls
              variant="icon"
              enabled={gridEnabled}
              size={gridSize}
              style={gridStyle}
              onEnabledChange={setGridEnabled}
              onSizeChange={setGridSize}
              onStyleChange={setGridStyle}
            />
            <button className={snap ? 'active' : ''} onClick={() => setSnap((v) => !v)} title="Snap to grid">
              <Magnet size={18} />
            </button>
            {selectedIds.length >= 2 ? (
              <button
                type="button"
                className="ge-group-btn"
                onClick={groupSelection}
                title="รวม Group (Ctrl+G)"
              >
                <Layers size={16} /> Group ({selectedIds.length})
              </button>
            ) : null}
            <button
              className={`ge-live-btn${livePreview && !runMode ? ' active ge-live-on' : ''}`}
              onClick={() => !runMode && setLivePreview((v) => !v)}
              disabled={runMode}
              title="Live preview — แสดงค่าจริงจาก Engine ขณะออกแบบ"
            >
              <Activity size={16} /> Live
            </button>
            <button
              className={`ge-run-btn${runMode ? ' active ge-run-on' : ''}`}
              onClick={toggleRunMode}
              title="Run mode — ทดสอบหน้าจอแบบ Client (คลิกปุ่ม/เปลี่ยนหน้าได้)"
            >
              {runMode ? <Pencil size={16} /> : <Play size={16} />}
              {runMode ? 'Edit' : 'Run'}
            </button>
            {g ? (
              <button
                className="ge-live-btn"
                style={{
                  background: validationOpen ? '#cbd5e1' : (validationIssues.length > 0 ? '#fee2e2' : '#f0fdf4'),
                  color: validationIssues.length > 0 ? '#ef4444' : '#22c55e',
                  border: validationIssues.length > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => setValidationOpen((v) => !v)}
                title="Validation Checks — สแกนความสมบูรณ์และข้อผิดพลาด"
              >
                {validationIssues.length > 0 ? `⚠️ ${validationIssues.length} ปัญหา` : '✅ สมบูรณ์ดี'}
              </button>
            ) : null}
          </div>
          )}
          </>
          )}
        </div>

        <div className="ge-top-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={editorUiMode}
            onChange={(e) => changeUiMode(e.target.value as any)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontWeight: 'bold',
              color: '#334155',
            }}
          >
            <option value="simple">🟢 Simple Mode (โหมดง่าย)</option>
            <option value="advanced">🔵 Advanced Mode (โหมดขั้นสูง)</option>
            <option value="building">🟠 Building / 3D Mode (โหมด 3D)</option>
          </select>
          {doc.dirty ? <span className="ge-dirty">● unsaved</span> : null}
          <button className="ge-save" onClick={() => doc.saveGraphic()} disabled={doc.busy || !doc.selectedId}>
            <Save size={18} /> Save
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="ge-body">
        {!runMode && !htmlExplore && (mode === '2d' || isHtmlPage) ? (
          <EditorLeftDock
            activeTool={activeTool}
            onPickTool={pickTool}
            disabled={!doc.selectedId}
            devices={doc.devices}
            onAssetsChange={refreshCatalogAssets}
            editorUiMode={editorUiMode}
          />
        ) : null}

        <div className="ge-stage">
          {floorLevels.length > 0 ? (
            <GraphicNavigationBar
              canGoBack={false}
              onBack={() => undefined}
              floors={floorLevels}
              activeFloor={activeFloor}
              onFloorChange={setActiveFloor}
              className="ge-floor-bar"
            />
          ) : null}
          {placing && placingLabel ? (
            <div className="ge-place-hint">
              {pathEditId ? 'แก้' : 'วาง'}: <strong>{placingLabel}</strong>
              {pathEditId ? ' · Enter เสร็จ' : ''} · Esc ยกเลิก
            </div>
          ) : null}
          {!doc.selectedId ? (
            <div className="ge-stage-empty">
              <ImagePlus size={44} color="#475569" />
              <h3>เริ่มออกแบบกราฟิก</h3>
              <ol className="ge-start-steps">
                <li>กด <strong>สร้างกราฟิก</strong> (canvas SCADA) หรือ <strong>Import HTML</strong> สำหรับหน้าโมเดล 3D</li>
                <li>วาง widget จากแท็บ <strong>Widgets</strong> · วาด SLD จากแท็บ <strong>SLD</strong></li>
                <li>ผูก tag → Save → Export to Monitor</li>
              </ol>
              <div className="ge-start-actions">
                <button className="ge-save" onClick={() => setShowNew(true)}>สร้าง Canvas</button>
                <button className="ge-save ge-save-alt" onClick={() => htmlImportRef.current?.click()}>Import HTML</button>
                <button className="ge-save ge-save-alt" onClick={() => glbImportRef.current?.click()}>Import GLB</button>
              </div>
            </div>
          ) : g ? (
            <EditorCanvas
              objects={doc.objects}
              width={width}
              height={height}
              backgroundColor={bg}
              backgroundImage={bgImage}
              zoom={zoom}
              gridEnabled={gridEnabled}
              gridSize={gridSize}
              gridStyle={gridStyle}
              snap={snap}
              mode={mode}
              camera={camera}
              placing={placing}
              panning={activeTool === 'pan' && !runMode}
              graphicId={doc.selectedId}
              selectedIds={selectedIds}
              selectedId={selectedId}
              onSelect={handleSelect}
              onPlace={handlePlace}
              onMutate={doc.updateObject}
              onNavigate={(id) => { doc.selectGraphic(id); setSelectedIds([]); }}
              onWriteTag={handleWriteTag}
              onDropFiles={handleDropFiles}
              onDropScenePayload={(payload, x, y) => {
                const placed = objectsFromSceneCatalogPayload(payload, x, y, {
                  graphicWidth: width,
                  graphicHeight: height,
                  mmPerPx: g?.layout?.sceneScaleMmPerPx,
                  zTop,
                });
                placed.forEach((o) => doc.addObject(bindPlacedToHtmlAnchor(o, o.x, o.y)));
                handleSelect(placed[0]?.id ?? null);
              }}
              livePreview={livePreview}
              runMode={runMode}
              currentValues={liveValues}
              alarms={liveAlarms}
              htmlLayout={isHtmlPage ? g.layout : null}
              resolveAssetRef={(ref) => resolveAssetRef(ref, loadGraphicAssets())}
              htmlFocus={isHtmlPage ? htmlFocus : 'widgets'}
              htmlAnchors={isHtmlPage ? htmlAnchors : undefined}
              onHtmlAnchorsChange={isHtmlPage ? setHtmlAnchors : undefined}
              onAnchorPick={isHtmlPage && htmlFocus === 'widgets' ? handleAnchorPick : undefined}
              activeFloor={floorLevels.length > 0 ? activeFloor : undefined}
            />
          ) : null}

          {validationOpen && g && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 200,
              background: '#ffffff',
              borderTop: '2px solid #cbd5e1',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'system-ui, sans-serif'
            }}>
              <div style={{
                padding: '6px 12px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#334155' }}>
                  🔍 ผลการตรวจสอบความถูกต้องและกติกา (HMI Validation Summary)
                </span>
                <button
                  onClick={() => setValidationOpen(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#64748b'
                  }}
                >
                  ย่อ/ปิด [X]
                </button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
                {validationIssues.length === 0 ? (
                  <div style={{ color: '#22c55e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: 12 }}>
                    <span>🎉 ไม่พบข้อผิดพลาดหรือคำเตือนใด ๆ! หน้าจอมีความสมบูรณ์พร้อมรันได้ทันที</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {validationIssues.map((issue) => (
                      <div
                        key={issue.id}
                        onClick={() => {
                          if (issue.objectId) {
                            handleSelect(issue.objectId);
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          background: issue.severity === 'error' ? '#fef2f2' : '#fffbeb',
                          border: issue.severity === 'error' ? '1px solid #fecaca' : '1px solid #fef3c7',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              background: issue.severity === 'error' ? '#ef4444' : '#f59e0b',
                              color: '#ffffff',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontSize: 9,
                              fontWeight: 'bold'
                            }}>
                              {issue.severity.toUpperCase()}
                            </span>
                            <strong style={{ color: '#1e293b' }}>{issue.objectName}:</strong>
                            <span style={{ color: '#334155' }}>{issue.message}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', paddingLeft: 46 }}>
                            💡 <em>{issue.suggestion}</em>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 'bold' }}>auto-select ⚡</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <InspectorPanel
          objects={doc.objects}
          selected={selectedObject}
          tags={doc.tags}
          devices={doc.devices}
          graphics={doc.graphics}
          currentGraphicId={doc.selectedId}
          canvasBg={bg}
          isHtmlPage={isHtmlPage}
          htmlAnchors={htmlAnchors}
          onCanvasBg={(color) => doc.patchLayout({ backgroundColor: color })}
          onSelect={handleSelect}
          onUpdate={doc.updateObject}
          onRemove={(id) => { doc.removeObject(id); setSelectedIds([]); }}
          onReorder={reorder}
          onUngroupGroup={ungroupGroup}
          onStartPathEdit={startPathEdit}
          editorUiMode={editorUiMode}
        />
      </div>

      <input
        ref={htmlImportRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={(e) => void handleImportHtmlPage(e.target.files?.[0]).finally(() => { e.target.value = ''; })}
      />
      <input
        ref={htmlReplaceRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={(e) => void handleImportHtmlPage(e.target.files?.[0], true).finally(() => { e.target.value = ''; })}
      />
      <input
        ref={glbImportRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        hidden
        onChange={(e) => void handleImportGlbBuilding(e.target.files?.[0]).finally(() => { e.target.value = ''; })}
      />
      <input
        ref={glbReplaceRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        hidden
        onChange={(e) => void handleImportGlbBuilding(e.target.files?.[0], true).finally(() => { e.target.value = ''; })}
      />

      {/* Notice */}
      {doc.notice ? (
        <div className={`ge-notice ge-notice-${doc.notice.kind}`}>{doc.notice.text}</div>
      ) : null}

      {/* ── Task 9: Binding Health + Audit Log Bar ─────────────────────── */}
      {doc.selectedId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '3px 12px', fontSize: 11, background: '#0f172a',
          borderTop: '1px solid #1e293b', color: '#94a3b8', userSelect: 'none',
        }}>
          <span style={{ fontWeight: 600, color: '#64748b' }}>🔗 Binding Health:</span>
          <span style={{
            padding: '2px 7px', borderRadius: 10,
            background: bindingHealth.unbound === 0 ? '#14532d' : '#7f1d1d',
            color: bindingHealth.unbound === 0 ? '#86efac' : '#fca5a5', fontWeight: 700,
          }}>
            {bindingHealth.bound}/{bindingHealth.total} bound
          </span>
          {bindingHealth.unbound > 0 && (
            <span style={{ color: '#f87171' }}>⚠ {bindingHealth.unbound} unbound object(s)</span>
          )}
          <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#60a5fa' }}
            onClick={() => setShowAuditLog(prev => !prev)}>
            📋 Audit Log ({auditLog.length}) {showAuditLog ? '▼' : '▶'}
          </span>
        </div>
      )}

      {/* Audit Log Drawer */}
      {showAuditLog && doc.selectedId && (
        <div style={{
          position: 'absolute', right: 0, bottom: 28, width: 360, maxHeight: 260,
          background: '#0f172a', borderLeft: '2px solid #1e40af',
          borderTop: '2px solid #1e40af', zIndex: 60,
          display: 'flex', flexDirection: 'column', fontSize: 11, color: '#94a3b8',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px', background: '#1e293b', fontWeight: 700, color: '#60a5fa' }}>
            <span>📋 HMI Audit Log (latest {Math.min(auditLog.length, 50)})</span>
            <span style={{ cursor: 'pointer', color: '#64748b' }}
              onClick={() => setShowAuditLog(false)}>✕</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {auditLog.length === 0 ? (
              <div style={{ padding: 12, color: '#475569' }}>No write commands recorded yet.</div>
            ) : [...auditLog].reverse().slice(0, 50).map((entry: any, i: number) => (
              <div key={i} style={{
                padding: '5px 10px', borderBottom: '1px solid #1e293b',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{entry.tagId ?? 'unknown'}</span>
                  <span style={{ color: '#475569' }}>{entry.ts ? new Date(entry.ts).toLocaleTimeString() : ''}</span>
                </div>
                <div>Value: <span style={{ color: '#86efac' }}>{String(entry.value)}</span>
                  {entry.reason ? <span style={{ color: '#fbbf24', marginLeft: 8 }}>Reason: {entry.reason}</span> : null}
                </div>
                {entry.operator ? <div style={{ color: '#64748b' }}>Op: {entry.operator}</div> : null}
              </div>
            ))}
          </div>
          {auditLog.length > 0 && (
            <div style={{ padding: '4px 10px', background: '#1e293b', textAlign: 'right' }}>
              <button style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  if (window.confirm('Clear all audit log entries?')) {
                    localStorage.removeItem('energylink:hmi-audit-log');
                    window.dispatchEvent(new Event('energylink:hmi-audit-log-changed'));
                  }
                }}>🗑 Clear Log</button>
            </div>
          )}
        </div>
      )}
      {/* ───────────────────────────────────────────────────────────────── */}

      {/* New graphic modal */}
      {showNew ? (
        <div className="ge-modal-overlay" onClick={() => setShowNew(false)}>
          <div className="ge-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'auto', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 550, maxHeight: '85vh' }}>
              <h3 style={{ margin: 0, fontSize: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>สร้างหน้าจอใหม่ (Screen Wizard)</h3>
              
              <label className="ins-row">
                <span>ชื่อหน้าจอ (Name)</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              </label>
              
              <div className="ins-grid2">
                <label className="ins-row">
                  <span>ความกว้าง W (Width)</span>
                  <input type="number" value={newW} onChange={(e) => setNewW(Number(e.target.value))} />
                </label>
                <label className="ins-row">
                  <span>ความสูง H (Height)</span>
                  <input type="number" value={newH} onChange={(e) => setNewH(Number(e.target.value))} />
                </label>
              </div>

              <div>
                <span style={{ fontSize: 13, fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: 6 }}>เลือกเทมเพลต (Choose Template)</span>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: 8,
                  background: '#f8fafc'
                }}>
                  {SCREEN_TEMPLATES.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setNewTemplate(t.id);
                        if (t.id === 'blank' || t.id === 'html_overlay' || t.id === 'glb_building') {
                          // keep defaults
                        } else {
                          setNewW(1366);
                          setNewH(768);
                        }
                      }}
                      style={{
                        padding: 8,
                        borderRadius: 4,
                        border: newTemplate === t.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: newTemplate === t.id ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <strong style={{ fontSize: 12, color: newTemplate === t.id ? '#1e40af' : '#1e293b' }}>{t.label}</strong>
                      <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.2 }}>{t.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ge-modal-actions" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                <button onClick={() => setShowNew(false)}>Cancel</button>
                <button
                  className="ge-save"
                  onClick={async () => {
                    const initialObjects = getTemplateInitialObjects(newTemplate, newW, newH);
                    const layoutPatch: any = {};
                    if (newTemplate === 'html_overlay') {
                      layoutPatch.pageKind = 'html';
                      layoutPatch.externalPage = { sandbox: 'strict', htmlContent: '<div style="color:white;padding:20px;"><h1>HTML Overlay</h1><p>วาง Widget ทับบนหน้านี้ได้เลย</p></div>' };
                    } else if (newTemplate === 'glb_building') {
                      layoutPatch.defaultCamera = 'orbit';
                      const buildingObj = {
                        id: `scene3d_${Date.now()}`,
                        type: 'scene3d',
                        x: 0,
                        y: 0,
                        width: newW,
                        height: newH,
                        layer: 1,
                        style: {
                          glbUrl: '',
                          sceneBuildMode: 'glb',
                          lightIntensity: 1,
                        }
                      };
                      initialObjects.push(buildingObj);
                    } else if (newTemplate === 'building_3d') {
                      layoutPatch.defaultCamera = 'orbit';
                    }
                    await doc.createGraphic(newName, Math.max(320, newW), Math.max(240, newH), initialObjects, layoutPatch);
                    setShowNew(false);
                  }}
                >
                  Create Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {safetyWriteModal && safetyWriteModal.isOpen ? (
        <div className="ge-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="ge-modal" style={{ width: 450, padding: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #fca5a5', paddingBottom: 8 }}>
              ⚠️ ยืนยันคำสั่งควบคุมความปลอดภัย (Command Safety Panel)
            </h3>
            
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div><strong>อุปกรณ์/Tag:</strong> <code style={{ color: '#1e293b', fontWeight: 'bold' }}>{safetyWriteModal.tagId}</code></div>
              <div><strong>ค่าที่กำลังส่ง (Target Value):</strong> <span style={{ background: '#3b82f6', color: '#ffffff', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>{String(safetyWriteModal.targetValue)}</span></div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 'bold', color: '#475569' }}>ตรวจสอบมาตรการความปลอดภัยหน้างาน:</span>
              
              <label style={{ display: 'flex', gap: 8, fontSize: 12, cursor: 'pointer', color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={safetyWriteModal.checkedInterlock}
                  onChange={(e) => setSafetyWriteModal((v) => v ? { ...v, checkedInterlock: e.target.checked } : null)}
                />
                <span>ฉันตรวจสอบ interlock/เงื่อนไขความปลอดภัยจริงแล้ว</span>
              </label>

              <label style={{ display: 'flex', gap: 8, fontSize: 12, cursor: 'pointer', color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={safetyWriteModal.checkedConfirm}
                  onChange={(e) => setSafetyWriteModal((v) => v ? { ...v, checkedConfirm: e.target.checked } : null)}
                />
                <span>ยืนยันการเปลี่ยนสถานะ Tag นี้ในระบบ SCADA</span>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569', marginTop: 4 }}>
                เหตุผลสั่งการสั่งเขียนค่า (Reason is required):
                <input
                  type="text"
                  placeholder="ระบุเหตุผลการเขียนคำสั่งควบคุม..."
                  value={safetyWriteModal.confirmReason}
                  onChange={(e) => setSafetyWriteModal((v) => v ? { ...v, confirmReason: e.target.value } : null)}
                  style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', outline: 'none' }}
                />
              </label>
            </div>

            {safetyWriteModal.status !== 'idle' && (
              <div style={{
                marginTop: 10,
                padding: '6px 10px',
                borderRadius: 4,
                fontSize: 12,
                textAlign: 'center',
                background: safetyWriteModal.status === 'writing' ? '#eff6ff' : safetyWriteModal.status === 'success' ? '#f0fdf4' : '#fef2f2',
                color: safetyWriteModal.status === 'writing' ? '#1d4ed8' : safetyWriteModal.status === 'success' ? '#166534' : '#991b1b',
                fontWeight: 'bold'
              }}>
                {safetyWriteModal.status === 'writing' ? 'กำลังส่งคำสั่งไปยัง Controller...' : safetyWriteModal.status === 'success' ? 'ส่งคำสั่งสำเร็จ!' : `ล้มเหลว: ${safetyWriteModal.statusText}`}
              </div>
            )}

            <div className="ge-modal-actions" style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setSafetyWriteModal(null)}
                disabled={safetyWriteModal.status === 'writing'}
              >
                Cancel
              </button>
              <button
                className="ge-save"
                disabled={
                  !safetyWriteModal.checkedInterlock ||
                  !safetyWriteModal.checkedConfirm ||
                  !safetyWriteModal.confirmReason.trim() ||
                  safetyWriteModal.status === 'writing'
                }
                style={{
                  background: (!safetyWriteModal.checkedInterlock || !safetyWriteModal.checkedConfirm || !safetyWriteModal.confirmReason.trim()) ? '#cbd5e1' : '#ef4444',
                  color: '#ffffff'
                }}
                onClick={async () => {
                  setSafetyWriteModal((v) => v ? { ...v, status: 'writing' } : null);
                  const res = await editorRuntimeApi.writeTag(safetyWriteModal.tagId, safetyWriteModal.targetValue);
                  if (res.ok) {
                    setSafetyWriteModal((v) => v ? { ...v, status: 'success' } : null);
                    logHmiAudit(safetyWriteModal.tagId, safetyWriteModal.targetValue, safetyWriteModal.confirmReason);
                    setTimeout(() => {
                      setSafetyWriteModal(null);
                      doc.setNotice({ kind: 'success', text: `Write ${safetyWriteModal.tagId} = ${safetyWriteModal.targetValue} success` });
                    }, 1000);
                  } else {
                    setSafetyWriteModal((v) => v ? { ...v, status: 'error', statusText: res.message || 'Error occurred' } : null);
                  }
                }}
              >
                Execute Command ⚡
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default GraphicsEditor;
