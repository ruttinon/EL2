import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useModal } from '../../context/ModalContext';
import type {
  GraphicObjectDefinition,
  GraphicObjectType,
  GraphicSummary,
  GraphicLayout,
  TagSummary,
  DeviceSummary,
  GraphicAsset,
  GraphicPort,
} from '@energylink/shared-types';
import {
  EDITOR_COMMAND_EVENT,
  normalizeCommand,
  type EditorCommand
} from '../../commandBus';
import { GRAPHIC_TEMPLATES, getGraphicTemplate } from './graphicsTemplates';
import {
  normalizeLayoutForSave, formatPathPoints, buildGraphicExportPackage, parseGraphicImportPackage, applyGraphicPackageToSummary, graphicPackageToCreateInput, parseMemberIds, formatMemberIds, applySceneDefaultsToStyle, dimensionsFromRealWorld, DEFAULT_MM_PER_PX,   buildAssetBundleFromLibrary, applyAssetBundleToLayout, parsePorts, formatPorts,   defaultPortsForType,
  createWireObject,
  updateConnectedWires,
  resolveWireEndpoints,
  findPort,
  createCable3dFromPorts,
  updateConnectedCables,
  syncCableFromLinkedWire,
  resolveCableEndpoints,
  computeWallSegment,
  buildRoomFromCorners,
  buildRoomFromPolygon,
  extractWallSegmentsFromStyles,
  buildRoomFromWallLoop,
  snapPointToWall,
  findNearestPort,
  snapDepthZ,
  ROOM_CORNER_COUNT,
  MIN_ROOM_CORNERS,
  autoGlbEquipmentPorts,
  resolveGlbPortsFromUrl,
  collectFloorLevels,
  resolveFloorVisible,
  validateFormulaSyntax,
  type CurrentTagValue,
} from '@energylink/graphics-runtime';
import { DEFAULT_ELEC_PORTS, DEFAULT_EQUIPMENT_PORTS, DEFAULT_BUS_PORTS, GRAPHIC_LAYOUT_VERSION_V2, type UnifiedCameraPreset } from '@energylink/shared-types';
import { normalizeGraphicLayout } from '@energylink/unified-viewport';
import '@energylink/unified-viewport/src/unified-viewport.css';
import { useGraphicEditorStore } from './state/graphicStore';
import { toolHintFor, toolHintFor3d } from './elementPanelUtils';
import { MIN_OBJECT_SIZE, type DisplayMode, type ExtendedObject, type ObjectDisplayExtra, getExtra } from './elementPanelTypes';
import { parseSceneScript } from './sceneScript/types';
import { buildSceneFromScript } from './sceneScript/buildSceneFromScript';
import { BLENDER_MCC_PYTHON } from './sceneScript/blenderExport';
import { GraphicsToolPalette } from './components/GraphicsToolPalette';
import { GraphicsLivePreview } from './GraphicsLivePreview';
import { parseSceneCatalogDrop, SCENE_CATALOG_MIME, type SceneCatalogDropPayload } from './GraphicsSceneCatalog';
import { GraphicEditorCanvas } from './components/GraphicEditorCanvas';
import { GraphicEditorToolbar, type EditorViewMode } from './components/GraphicEditorToolbar';
import { GraphicPropertiesSidebar, type PropTab } from './components/GraphicPropertiesSidebar';
import { GraphicElementPropertiesPanel } from './components/GraphicElementPropertiesPanel';
import { GraphicSceneCatalogStrip, type CatalogStripCategory } from './components/GraphicSceneCatalogStrip';
import { DEFAULT_VIEWPORT_DEBUG, passesViewportDebug } from './editorViewportDebug';
import { findRoomPrefab, roomPrefabCorners } from './roomPrefabs';
import { loadGraphicAssets, saveGraphicAssets, assetsByKind, readFileAsDataUrl, assetKindFromFile } from './graphicAssets';
import { resolveImageUrl, imageObjectPatch, shouldExtrudeAs3dBox, imageTo3dBoxStyle } from './imageHelpers';
import { clampBoxDepth } from './boxDepth';
import './graphics-workspace-v2.css';
import {
  detectGlbMode,
  downloadGlbBlob,
  imageDataUrlToGlbBlob,
  type ImageToGlbMode,
} from './imageToGlb';
import { editorRuntimeApi, type FlowStyleSnapshot } from '../../api/editorRuntimeApi';
import { loadCanvasZoom, saveCanvasZoom } from './editorCanvasZoom';
import type { GraphicLayoutSnapshot } from '@energylink/shared-types';

type Notice = { kind: 'success' | 'error'; text: string } | null;
type CanvasTool = GraphicObjectType | 'select' | 'pan' | 'wire' | 'cable3d' | 'wall' | 'room' | 'measure' | 'door' | 'window';
type DragState = { objectId: string; startX: number; startY: number; originX: number; originY: number; memberIds?: string[] } | null;
type ResizeState = { objectId: string; corner: 'se'; startX: number; startY: number; originW: number; originH: number } | null;

/** @deprecated use loadGraphicAssets — kept for canvas background picker compat */
type ImageItem = { id: string; name: string; dataUrl: string; createdAt: string };

const GRID_SIZE = 20;
const CANVAS_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
const EQUIPMENT_WALL_SNAP_TYPES = new Set(['viewport3d', 'image', 'elecsymbol', 'rectangle', 'group']);

type PaletteCategory = 'scene' | 'layout' | 'sld' | 'values' | 'charts' | 'tables' | 'control' | 'effects' | 'media' | 'energy' | 'document';

const toolCategories: Record<PaletteCategory, { label: string; icon: string; color: string; types: GraphicObjectType[] }> = {
  scene:   { label: 'Scene / 3D', icon: 'solar:box-bold-duotone', color: '#8b5cf6', types: [] },
  layout:  { label: 'Layout', icon: 'solar:square-top-down-bold-duotone', color: '#3b82f6', types: ['text', 'image', 'rectangle', 'line', 'circle', 'ellipse', 'polygon', 'panel', 'group', 'section'] },
  sld:     { label: 'SLD / Elec', icon: 'solar:transmission-bold-duotone', color: '#f59e0b', types: ['flowpath', 'pipe', 'cable3d', 'elecsymbol', 'bussection', 'feedlabel', 'hotspot', 'zone3d', 'zone2d', 'wall'] },
  values:  { label: 'Values', icon: 'solar:hashtag-bold-duotone', color: '#0ea5e9', types: ['value', 'gauge', 'progressbar', 'led', 'semaphore', 'multistate', 'sparkline', 'kpicard', 'formulavalue', 'statusbadge', 'clock', 'variable'] },
  charts:  { label: 'Charts', icon: 'solar:chart-square-bold-duotone', color: '#a855f7', types: ['trend', 'barchart', 'piechart', 'echart'] },
  tables:  { label: 'Tables', icon: 'solar:bill-list-bold-duotone', color: '#10b981', types: ['tagtable', 'alarmtable', 'alarm', 'toutable'] },
  control: { label: 'Controls', icon: 'solar:cursor-bold-duotone', color: '#ec4899', types: ['button', 'switch', 'slider', 'levelbar', 'navbutton', 'tabbar', 'inputfield', 'dropdown'] },
  effects: { label: 'Effects', icon: 'solar:magic-stick-bold-duotone', color: '#6366f1', types: ['sprite', 'lottie', 'viewport3d', 'scene3d'] },
  media:   { label: 'Media / Web', icon: 'solar:play-circle-bold-duotone', color: '#14b8a6', types: ['video', 'iframe', 'qrcode', 'signature'] },
  energy:  { label: 'Energy', icon: 'solar:bolt-circle-bold-duotone', color: '#f97316', types: ['energysummary', 'powerquality', 'demandsummary'] },
  document:{ label: 'Document', icon: 'solar:document-bold-duotone', color: '#64748b', types: ['headerfooter', 'pagebreak'] },
};

const objectTools: Array<{
  type: GraphicObjectType;
  label: string;
  icon: React.ReactNode;
  width: number;
  height: number;
  text?: string;
}> = [
  // ── Layout
  { type: 'text',        label: 'Text',        icon: <Icon icon="solar:text-bold-duotone"               width="20" height="20" style={{ color: '#3b82f6' }} />, width: 180, height: 44,  text: 'New Text' },
  { type: 'image',       label: 'Image',       icon: <Icon icon="solar:gallery-bold-duotone"            width="20" height="20" style={{ color: '#10b981' }} />, width: 180, height: 100 },
  { type: 'rectangle',  label: 'Rectangle',   icon: <Icon icon="solar:square-bold-duotone"             width="20" height="20" style={{ color: '#3b82f6' }} />, width: 180, height: 100, text: 'Rectangle' },
  { type: 'line',        label: 'Line',        icon: <Icon icon="solar:pen-bold-duotone"                width="20" height="20" style={{ color: '#6b7280' }} />, width: 220, height: 4,   text: 'Line' },
  { type: 'circle',     label: 'Circle',      icon: <Icon icon="solar:circle-bold-duotone"             width="20" height="20" style={{ color: '#0ea5e9' }} />, width: 110, height: 110 },
  { type: 'ellipse',    label: 'Ellipse',     icon: <Icon icon="solar:oval-bold-duotone"               width="20" height="20" style={{ color: '#06b6d4' }} />, width: 160, height: 90 },
  { type: 'polygon',    label: 'Polygon',     icon: <Icon icon="solar:triangle-bold-duotone"           width="20" height="20" style={{ color: '#f97316' }} />, width: 140, height: 120 },
  { type: 'panel',      label: 'Panel',       icon: <Icon icon="solar:widget-4-bold-duotone"           width="20" height="20" style={{ color: '#64748b' }} />, width: 280, height: 200, text: 'Panel' },
  { type: 'group',      label: 'Group',       icon: <Icon icon="solar:layers-minimalistic-bold-duotone" width="20" height="20" style={{ color: '#64748b' }} />, width: 200, height: 160, text: 'Group' },
  // ── Values / Gauges
  { type: 'value',      label: 'Value',       icon: <Icon icon="solar:hashtag-bold-duotone"            width="20" height="20" style={{ color: '#0ea5e9' }} />, width: 190, height: 70 },
  { type: 'gauge',      label: 'Gauge',       icon: <Icon icon="solar:compass-bold-duotone"            width="20" height="20" style={{ color: '#f59e0b' }} />, width: 180, height: 120, text: 'Gauge' },
  { type: 'progressbar',label: 'Progress',    icon: <Icon icon="solar:battery-charge-bold-duotone"     width="20" height="20" style={{ color: '#22c55e' }} />, width: 220, height: 28 },
  { type: 'led',        label: 'LED',         icon: <Icon icon="solar:lightbulb-bold-duotone"          width="20" height="20" style={{ color: '#facc15' }} />, width: 36,  height: 36 },
  { type: 'semaphore',  label: 'Semaphore',   icon: <Icon icon="solar:traffic-economy-bold-duotone"    width="20" height="20" style={{ color: '#ef4444' }} />, width: 60,  height: 160 },
  { type: 'multistate', label: 'Multi-State', icon: <Icon icon="solar:layers-bold-duotone"             width="20" height="20" style={{ color: '#6366f1' }} />, width: 90,  height: 90,  text: 'State' },
  { type: 'levelbar',   label: 'Level Bar',   icon: <Icon icon="solar:waterdrop-bold-duotone"          width="20" height="20" style={{ color: '#0891b2' }} />, width: 70,  height: 220, text: 'Level' },
  { type: 'sparkline',  label: 'Sparkline',   icon: <Icon icon="solar:graph-up-bold-duotone"           width="20" height="20" style={{ color: '#8b5cf6' }} />, width: 240, height: 70 },
  { type: 'kpicard',    label: 'KPI Card',    icon: <Icon icon="solar:chart-bold-duotone"              width="20" height="20" style={{ color: '#0ea5e9' }} />, width: 200, height: 120, text: 'KPI' },
  { type: 'formulavalue',label:'Formula',     icon: <Icon icon="solar:calculator-bold-duotone"         width="20" height="20" style={{ color: '#6366f1' }} />, width: 190, height: 72,  text: 'Formula' },
  { type: 'statusbadge',label: 'Status',      icon: <Icon icon="solar:tag-bold-duotone"                width="20" height="20" style={{ color: '#14b8a6' }} />, width: 130, height: 40 },
  { type: 'clock',      label: 'Clock',       icon: <Icon icon="solar:clock-circle-bold-duotone"       width="20" height="20" style={{ color: '#0ea5e9' }} />, width: 200, height: 72,  text: 'Clock' },
  // ── Charts
  { type: 'trend',      label: 'Trend',       icon: <Icon icon="solar:chart-square-bold-duotone"       width="20" height="20" style={{ color: '#8b5cf6' }} />, width: 320, height: 150 },
  { type: 'barchart',   label: 'Bar Chart',   icon: <Icon icon="solar:chart-2-bold-duotone"            width="20" height="20" style={{ color: '#f59e0b' }} />, width: 320, height: 180, text: 'Compare' },
  { type: 'piechart',   label: 'Pie Chart',   icon: <Icon icon="solar:pie-chart-2-bold-duotone"        width="20" height="20" style={{ color: '#f97316' }} />, width: 280, height: 200, text: 'Share' },
  { type: 'echart',     label: 'EChart',      icon: <Icon icon="solar:chart-square-bold-duotone"       width="20" height="20" style={{ color: '#a855f7' }} />, width: 320, height: 200 },
  // ── Tables
  { type: 'tagtable',   label: 'Tag Table',   icon: <Icon icon="solar:bill-list-bold-duotone"          width="20" height="20" style={{ color: '#10b981' }} />, width: 360, height: 220, text: 'Tags' },
  { type: 'alarmtable', label: 'Alarm Table', icon: <Icon icon="solar:danger-triangle-bold-duotone"    width="20" height="20" style={{ color: '#ef4444' }} />, width: 400, height: 200, text: 'Alarms' },
  { type: 'alarm',      label: 'Alarm',       icon: <Icon icon="solar:bell-bing-bold-duotone"          width="20" height="20" style={{ color: '#ef4444' }} />, width: 180, height: 70 },
  // ── Controls
  { type: 'button',     label: 'Button',      icon: <Icon icon="solar:cursor-square-bold-duotone"      width="20" height="20" style={{ color: '#ec4899' }} />, width: 160, height: 54,  text: 'Button' },
  { type: 'switch',     label: 'Switch',      icon: <Icon icon="solar:toggle-bold-duotone"             width="20" height="20" style={{ color: '#22c55e' }} />, width: 96,  height: 44,  text: 'OFF' },
  { type: 'slider',     label: 'Slider',      icon: <Icon icon="solar:sliders-bold-duotone"            width="20" height="20" style={{ color: '#a855f7' }} />, width: 220, height: 40 },
  { type: 'inputfield', label: 'Input',       icon: <Icon icon="solar:keyboard-bold-duotone"           width="20" height="20" style={{ color: '#0ea5e9' }} />, width: 200, height: 44,  text: '' },
  { type: 'dropdown',   label: 'Dropdown',    icon: <Icon icon="solar:list-down-bold-duotone"          width="20" height="20" style={{ color: '#6366f1' }} />, width: 200, height: 44,  text: 'Choose...' },
  { type: 'navbutton',  label: 'Nav Button',  icon: <Icon icon="solar:arrow-right-square-bold-duotone" width="20" height="20" style={{ color: '#0d9488' }} />, width: 170, height: 50,  text: 'Go to Screen' },
  { type: 'tabbar',     label: 'Tab Bar',     icon: <Icon icon="solar:folder-with-files-bold-duotone"  width="20" height="20" style={{ color: '#6366f1' }} />, width: 400, height: 44,  text: 'Navigation' },
  // ── SLD / Elec
  { type: 'flowpath',   label: 'Flow Path',   icon: <Icon icon="solar:routing-2-bold-duotone"          width="20" height="20" style={{ color: '#22d3ee' }} />, width: 280, height: 48,  text: 'Power Line' },
  { type: 'pipe',       label: 'Pipe',        icon: <Icon icon="solar:pipes-bold-duotone"              width="20" height="20" style={{ color: '#06b6d4' }} />, width: 240, height: 40,  text: 'Pipe' },
  { type: 'cable3d',    label: 'Cable 3D',    icon: <Icon icon="solar:link-circle-bold-duotone"        width="20" height="20" style={{ color: '#a78bfa' }} />, width: 280, height: 48,  text: 'Cable 3D' },
  { type: 'elecsymbol', label: 'Elec Symbol', icon: <Icon icon="solar:plug-circle-bold-duotone"        width="20" height="20" style={{ color: '#f59e0b' }} />, width: 72,  height: 72,  text: 'CB-01' },
  { type: 'bussection', label: 'Bus Section', icon: <Icon icon="solar:transmission-bold-duotone"       width="20" height="20" style={{ color: '#173047' }} />, width: 320, height: 48,  text: 'Bus-A' },
  { type: 'feedlabel',  label: 'Feed Label',  icon: <Icon icon="solar:tag-horizontal-bold-duotone"     width="20" height="20" style={{ color: '#0ea5e9' }} />, width: 120, height: 44,  text: 'Feeder-1' },
  { type: 'hotspot',    label: 'Hotspot',     icon: <Icon icon="solar:target-bold-duotone"             width="20" height="20" style={{ color: '#06b6d4' }} />, width: 48,  height: 48 },
  { type: 'zone3d',     label: 'Room Zone',   icon: <Icon icon="solar:map-point-bold-duotone"          width="20" height="20" style={{ color: '#6366f1' }} />, width: 120, height: 80,  text: 'Zone' },
  { type: 'zone2d',     label: 'Zone 2D',     icon: <Icon icon="solar:map-bold-duotone"                width="20" height="20" style={{ color: '#6366f1' }} />, width: 160, height: 100, text: 'Zone' },
  { type: 'wall',       label: 'Wall',        icon: <Icon icon="solar:home-2-bold-duotone"             width="20" height="20" style={{ color: '#94a3b8' }} />, width: 200, height: 20,  text: 'Wall' },
  // ── Effects
  { type: 'sprite',     label: 'Sprite',      icon: <Icon icon="solar:filmstrip-bold-duotone"          width="20" height="20" style={{ color: '#a855f7' }} />, width: 96,  height: 96,  text: 'Sprite' },
  { type: 'lottie',     label: 'Lottie',      icon: <Icon icon="solar:clapperboard-play-bold-duotone"  width="20" height="20" style={{ color: '#ec4899' }} />, width: 160, height: 160, text: 'Animation' },
  { type: 'viewport3d', label: '3D View',     icon: <Icon icon="solar:cube-bold-duotone"               width="20" height="20" style={{ color: '#6366f1' }} />, width: 280, height: 220, text: '3D Model' },
  { type: 'scene3d',    label: 'Full 3D',     icon: <Icon icon="solar:full-screen-bold-duotone"        width="20" height="20" style={{ color: '#4f46e5' }} />, width: 1366, height: 768, text: '3D Scene' },
  // ── Media
  { type: 'video',      label: 'Video',       icon: <Icon icon="solar:play-circle-bold-duotone"        width="20" height="20" style={{ color: '#14b8a6' }} />, width: 320, height: 200 },
  { type: 'iframe',     label: 'iFrame',      icon: <Icon icon="solar:global-bold-duotone"             width="20" height="20" style={{ color: '#0ea5e9' }} />, width: 400, height: 280, text: 'https://' },
  { type: 'qrcode',     label: 'QR Code',     icon: <Icon icon="solar:qr-code-bold-duotone"            width="20" height="20" style={{ color: '#64748b' }} />, width: 120, height: 120 },
  { type: 'signature',  label: 'Signature',   icon: <Icon icon="solar:pen-new-round-bold-duotone"      width="20" height="20" style={{ color: '#ec4899' }} />, width: 200, height: 80, text: 'Sign Here' },
  // ── Document & Report
  { type: 'section',    label: 'Section',     icon: <Icon icon="solar:archive-minimalistic-bold-duotone" width="20" height="20" style={{ color: '#3b82f6' }} />, width: 600, height: 300, text: 'Section' },
  { type: 'headerfooter',label: 'Header',     icon: <Icon icon="solar:minus-square-bold-duotone"       width="20" height="20" style={{ color: '#64748b' }} />, width: 800, height: 60 },
  { type: 'pagebreak',  label: 'Page Break',  icon: <Icon icon="solar:scissor-bold-duotone"            width="20" height="20" style={{ color: '#f43f5e' }} />, width: 800, height: 20 },
  { type: 'variable',   label: 'Variable',    icon: <Icon icon="solar:text-field-focus-bold-duotone"   width="20" height="20" style={{ color: '#8b5cf6' }} />, width: 150, height: 30, text: '{project_name}' },
  { type: 'toutable',   label: 'TOU Table',   icon: <Icon icon="solar:calendar-date-bold-duotone"      width="20" height="20" style={{ color: '#10b981' }} />, width: 400, height: 250 },
  // ── Energy Link
  { type: 'energysummary',label: 'Energy Sum',icon: <Icon icon="solar:bolt-circle-bold-duotone"        width="20" height="20" style={{ color: '#f59e0b' }} />, width: 300, height: 180 },
  { type: 'demandsummary',label: 'Demand Sum',icon: <Icon icon="solar:graph-new-bold-duotone"          width="20" height="20" style={{ color: '#ef4444' }} />, width: 300, height: 180 },
  { type: 'powerquality',label: 'PQ Summary', icon: <Icon icon="solar:health-bold-duotone"             width="20" height="20" style={{ color: '#06b6d4' }} />, width: 350, height: 200 },
];

function findViewportHost(
  objects: GraphicObjectDefinition[],
  obj: { x: number; y: number; width: number; height: number },
): string | undefined {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  for (const host of objects) {
    if (host.type !== 'viewport3d' && host.type !== 'scene3d') continue;
    if (cx >= host.x && cx <= host.x + host.width && cy >= host.y && cy <= host.y + host.height) {
      return host.id;
    }
  }
  return undefined;
}

function syncScene3dObjects(
  objects: GraphicObjectDefinition[],
  width: number,
  height: number,
): GraphicObjectDefinition[] {
  return objects.map((o) =>
    o.type === 'scene3d' ? { ...o, x: 0, y: 0, width, height, layer: 0 } : o,
  );
}

function defaultLayout() {
  return {
  version: 1 as const,
  backgroundColor: '#fbfdff',
  backgroundImage: null,
    objects: [] as GraphicObjectDefinition[],
  };
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.round(performance.now() * 1000)}`;
}

function snap(value: number, enabled: boolean) {
  if (!enabled) return Math.round(value);
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeObject(type: GraphicObjectType, index: number, x?: number, y?: number): GraphicObjectDefinition {
  const tool = objectTools.find((item) => item.type === type) || objectTools[0];
  const id = makeId(type);
  return {
    id,
    type,
    name: `${tool.label}_${id.slice(-6)}`,
    x: x ?? 40 + (index % 4) * 34,
    y: y ?? 60 + (index % 6) * 28,
    width: tool.width,
    height: tool.height,
    text: tool.text,
    visible: true,
    locked: false,
    layer: Date.now(),
    style: applySceneDefaultsToStyle(type, {
      fill: '#ffffff',
      stroke: '#9fc4cc',
      strokeWidth: 1,
      color: '#142033',
      fontSize: 16,
      background: '#ffffff',
      align: 'center',
    }),
  };
}

function validateGraphic(graphic: GraphicSummary): { hardErrors: string[]; warnings: string[] } {
  const hardErrors: string[] = [];
  const warnings: string[] = [];
  const names = new Set<string>();

  if (!graphic.name.trim()) hardErrors.push('Graphic name is required');
  if (!Number.isFinite(graphic.width) || graphic.width < 320) hardErrors.push('Graphic width must be at least 320');
  if (!Number.isFinite(graphic.height) || graphic.height < 240) hardErrors.push('Graphic height must be at least 240');

  for (const object of graphic.layout.objects) {
    const objectName = object.name?.trim() || object.id;
    if (!object.name?.trim()) warnings.push(`Object ${object.id} has no name`);
    const key = objectName.toLowerCase();
    if (names.has(key)) hardErrors.push(`Duplicate object name: ${objectName}`);
    names.add(key);

    if (object.width < MIN_OBJECT_SIZE || object.height < MIN_OBJECT_SIZE) {
      hardErrors.push(`${objectName} is too small`);
    }
    if (object.x < 0 || object.y < 0) hardErrors.push(`${objectName} is outside canvas`);
    if (object.x + object.width > graphic.width || object.y + object.height > graphic.height) {
      hardErrors.push(`${objectName} exceeds canvas boundary`);
    }
    if ((object.type === 'value' || object.type === 'gauge' || object.type === 'alarm'
      || object.type === 'led' || object.type === 'status' || object.type === 'levelbar' || object.type === 'multistate'
      || object.type === 'switch' || object.type === 'slider' || object.type === 'sparkline' || object.type === 'hotspot') && !object.binding?.tagId) {
      warnings.push(`${objectName}: ยังไม่ผูก Tag`);
    }
    if (object.type === 'trend' && !(object as ExtendedObject).tagIds?.length && !object.binding?.tagIds?.length && !object.binding?.tagId) {
      warnings.push(`${objectName}: trend ยังไม่มี tag`);
    }
    if (object.type === 'flowpath' && !object.binding?.flowTagId && !object.binding?.tagId) {
      warnings.push(`${objectName}: flow path ยังไม่ผูก Flow Tag`);
    }
    if (object.type === 'pipe' && !object.binding?.flowTagId && !object.binding?.tagId) {
      warnings.push(`${objectName}: pipe ยังไม่ผูก Flow Tag`);
    }
    if (object.type === 'flowpath') {
      const endpoints = resolveWireEndpoints(object.style);
      if (endpoints.fromObjectId || endpoints.toObjectId) {
        if (!endpoints.fromObjectId || !endpoints.fromPortId || !endpoints.toObjectId || !endpoints.toPortId) {
          warnings.push(`${objectName}: wire เชื่อม port ไม่ครบ`);
        } else {
          const fromObj = graphic.layout.objects.find((o) => o.id === endpoints.fromObjectId);
          const toObj = graphic.layout.objects.find((o) => o.id === endpoints.toObjectId);
          if (!fromObj) warnings.push(`${objectName}: wire source object missing`);
          if (!toObj) warnings.push(`${objectName}: wire destination object missing`);
        }
      }
    }
    if (object.type === 'elecsymbol' && !object.binding?.tagId) {
      warnings.push(`${object.name} (symbol): ยังไม่ผูก State Tag`);
    }
    if (object.type === 'barchart' && !(object as ExtendedObject).tagIds?.length && !object.binding?.tagIds?.length) {
      warnings.push(`${objectName}: bar chart ยังไม่มี tag`);
    }
    if (object.type === 'piechart' && !(object as ExtendedObject).tagIds?.length && !object.binding?.tagIds?.length) {
      warnings.push(`${objectName}: pie chart ยังไม่มี tag`);
    }
    if ((object.type === 'button' || object.type === 'switch' || object.type === 'slider') && !object.binding?.tagId) {
      warnings.push(`${objectName} (control): ยังไม่ผูก write Tag`);
    }
    if (object.type === 'kpicard' && !object.binding?.tagId) {
      warnings.push(`${objectName} (KPI): ยังไม่ผูก Tag`);
    }
    if (object.type === 'formulavalue' && !(object as ExtendedObject).tagIds?.length && !object.binding?.tagIds?.length && !object.binding?.tagId) {
      warnings.push(`${objectName}: formula ยังไม่มี tag`);
    }
    if (object.type === 'formulavalue') {
      const tagIds = (object as ExtendedObject).tagIds || object.binding?.tagIds || (object.binding?.tagId ? [object.binding.tagId] : []);
      const formula = String(object.style?.formula ?? '');
      const check = validateFormulaSyntax(formula, tagIds);
      if (!check.ok) warnings.push(`${objectName}: formula — ${check.error}`);
    }
    if (object.type === 'status' && !object.deviceId && !object.binding?.tagId && !object.tagId) {
      warnings.push(`${objectName}: สถานะยังไม่ผูกอุปกรณ์หรือ tag`);
    }
    if (object.type === 'statusbadge' && !object.binding?.tagId) {
      warnings.push(`${objectName}: status badge ยังไม่ผูก Tag`);
    }
    if (object.type === 'zone3d') {
      const navTarget = object.navigateTo ?? object.style?.navigateTo;
      if (!navTarget) warnings.push(`${objectName} (room zone): ยังไม่ตั้ง navigateTo`);
    }
    if (object.type === 'feedlabel' && !object.binding?.flowTagId && !object.binding?.tagId) {
      warnings.push(`${objectName} (feed label): ยังไม่ผูก Tag`);
    }
    if (object.type === 'cable3d' && !object.binding?.flowTagId && !object.binding?.tagId) {
      warnings.push(`${object.name} (cable 3D): ยังไม่ผูก Flow Tag`);
    }
  }

  return { hardErrors, warnings };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadImagesFromAssets(assets: GraphicAsset[]): ImageItem[] {
  return assetsByKind(assets, 'image').map((a) => ({
    id: a.id,
    name: a.name,
    dataUrl: a.url,
    createdAt: a.createdAt,
  }));
}

export function GraphicsWorkspace() {
  const { showConfirm } = useModal();
  const [activeProject, setActiveProject] = useState<{ id: string; name: string } | null>(null);
  const [graphics, setGraphics] = useState<GraphicSummary[]>([]);
  const [selectedGraphicId, setSelectedGraphicId] = useState<string>('');
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [assets, setAssets] = useState<GraphicAsset[]>([]);
  const images = useMemo(() => loadImagesFromAssets(assets), [assets]);
  const model3dAssets = useMemo(() => assetsByKind(assets, 'model3d'), [assets]);
  const splineAssets = useMemo(() => assetsByKind(assets, 'spline'), [assets]);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [isBusy, setIsBusy] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snap3dEnabled, setSnap3dEnabled] = useState(true);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [dragState, setDragState] = useState<DragState>(null);
  const [resizeState, setResizeState] = useState<ResizeState>(null);
  const [isNewGraphicModalOpen, setIsNewGraphicModalOpen] = useState(false);
  const [propTab, setPropTab] = useState<PropTab>('canvas');
  const [elementPropMode, setElementPropMode] = useState<'quick' | 'advanced'>('quick');
  // For the device→tag binding panel: track which device is currently chosen in the filter
  const [bindingDeviceId, setBindingDeviceId] = useState<string>('');
  const [newGraphic, setNewGraphic] = useState({
    name: '',
    width: 1366,
    height: 768,
    refreshIntervalMs: 1000,
    templateId: 'blank-scene'
  });
  const [paletteTab, setPaletteTab] = useState<PaletteCategory>('layout');
  const cameraPreset = useGraphicEditorStore((s) => s.cameraPreset);
  const setCameraPreset = useGraphicEditorStore((s) => s.setCameraPreset);
  const is3dCamera = cameraPreset === 'top' || cameraPreset === 'orbit';
  const [wireFrom, setWireFrom] = useState<{ objectId: string; portId: string } | null>(null);
  const [wireCursor, setWireCursor] = useState<{ x: number; y: number } | null>(null);
  const [pathEditId, setPathEditId] = useState<string | null>(null);
  // Wall drawing tool state: first click sets start point, second click completes the wall
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [wallCursor, setWallCursor] = useState<{ x: number; y: number } | null>(null);
  const [roomPoints, setRoomPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [openingSnap, setOpeningSnap] = useState<{ x: number; y: number; angleDeg: number; kind: 'door' | 'window' } | null>(null);
  const [snapWirePort, setSnapWirePort] = useState<{ objectId: string; port: GraphicPort; x: number; y: number } | null>(null);
  const [r3fTagValues, setR3fTagValues] = useState<Map<string, { value?: unknown; unit?: string | null }>>(new Map());
  const [editorCurrentValues, setEditorCurrentValues] = useState<CurrentTagValue[]>([]);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objectId?: string; type?: string } | null>(null);
  const [panState, setPanState] = useState<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [copiedFlowStyle, setCopiedFlowStyle] = useState<FlowStyleSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<GraphicLayoutSnapshot[]>([]);
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>('canvas');
  const [catalogStripCategory, setCatalogStripCategory] = useState<CatalogStripCategory>('equipment');
  const [catalogPlacePayload, setCatalogPlacePayload] = useState<SceneCatalogDropPayload | null>(null);
  const [armedCatalogId, setArmedCatalogId] = useState<string | null>(null);
  const [armedCatalogLabel, setArmedCatalogLabel] = useState<string | null>(null);
  const [armedRoomPrefabId, setArmedRoomPrefabId] = useState<string | null>(null);
  const [viewportDebug, setViewportDebug] = useState(DEFAULT_VIEWPORT_DEBUG);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const glbFileInputRef = useRef<HTMLInputElement>(null);
  const skipZoomSaveRef = useRef(false);

  const selectedGraphic = useMemo(
    () => graphics.find((graphic) => graphic.id === selectedGraphicId) || null,
    [graphics, selectedGraphicId]
  );

  const selectedObject = useMemo(
    () => selectedGraphic?.layout?.objects?.find((object) => object.id === selectedObjectId) || null,
    [selectedGraphic, selectedObjectId]
  );

  const selectedExtra = useMemo(
    () => (selectedObject ? getExtra(selectedObject) : null),
    [selectedObject]
  );

  // Sync propTab when object selection changes (keep layers tab if active)
  useEffect(() => {
    if (selectedObjectId) {
      setElementPropMode('quick');
      setPropTab((tab) => (tab === 'layers' ? tab : 'element'));
    } else {
      setPropTab((tab) => {
        if (tab === 'layers') return tab;
        const empty = (selectedGraphic?.layout?.objects?.length ?? 0) === 0;
        return empty ? 'script' : 'canvas';
      });
    }
  }, [selectedObjectId, selectedGraphic?.layout?.objects?.length]);

  useEffect(() => {
    setLiveModalOpen(false);
  }, [selectedGraphicId]);

  useEffect(() => {
    if (!selectedGraphicId) {
      setCanvasZoom(1);
      return;
    }
    skipZoomSaveRef.current = true;
    setCanvasZoom(loadCanvasZoom(selectedGraphicId));
  }, [selectedGraphicId]);

  useEffect(() => {
    if (!selectedGraphicId) return;
    if (skipZoomSaveRef.current) {
      skipZoomSaveRef.current = false;
      return;
    }
    saveCanvasZoom(selectedGraphicId, canvasZoom);
  }, [selectedGraphicId, canvasZoom]);

  useEffect(() => {
    if (!selectedGraphicId) {
      setSnapshots([]);
      return;
    }
    let cancelled = false;
    void window.energylink.graphics.listHistory(selectedGraphicId).then((items) => {
      if (!cancelled) setSnapshots(items);
    }).catch(() => {
      if (!cancelled) setSnapshots([]);
    });
    return () => { cancelled = true; };
  }, [selectedGraphicId]);

  useEffect(() => {
    if (!selectedGraphic) return;
    const cam = selectedGraphic.layout?.defaultCamera;
    if (cam === 'flat' || cam === 'top' || cam === 'orbit') setCameraPreset(cam);
    else setCameraPreset('flat');
    setActiveFloor(null);
  }, [selectedGraphic?.id, selectedGraphic?.layout?.defaultCamera, setCameraPreset]);

  const floorLevels = useMemo(
    () => collectFloorLevels(selectedGraphic?.layout?.objects ?? []),
    [selectedGraphic?.layout?.objects],
  );

  const viewportObjects = useMemo(() => {
    const objs = selectedGraphic?.layout?.objects ?? [];
    return objs.filter((o) => resolveFloorVisible(o, activeFloor));
  }, [selectedGraphic?.layout?.objects, activeFloor]);

  const canvasObjects = useMemo(() => {
    return viewportObjects.filter((o) => passesViewportDebug(o, viewportDebug));
  }, [viewportObjects, viewportDebug]);

  const catalogArmed = Boolean(catalogPlacePayload || armedRoomPrefabId);

  const canvasPointerActive = useMemo(() => {
    if (!is3dCamera) return true;
    if (pathEditId) return true;
    if (catalogArmed) return true;
    return (
      activeTool === 'wall' ||
      activeTool === 'room' ||
      activeTool === 'measure' ||
      activeTool === 'door' ||
      activeTool === 'window' ||
      activeTool === 'wire' ||
      activeTool === 'cable3d' ||
      activeTool === 'zone3d'
    );
  }, [is3dCamera, activeTool, pathEditId, catalogArmed]);

  const floorClickEnabled = is3dCamera && (activeTool === 'wall' || catalogArmed);

  const activeToolLabel = useMemo(() => {
    if (activeTool === 'select') return 'Select';
    if (activeTool === 'pan') return 'Pan';
    if (activeTool === 'wire') return 'Wire';
    if (activeTool === 'cable3d') return 'Cable 3D';
    if (activeTool === 'wall') return 'Wall';
    if (activeTool === 'room') return 'Room';
    if (activeTool === 'measure') return 'Measure';
    if (activeTool === 'door') return 'Door';
    if (activeTool === 'window') return 'Window';
    const match = objectTools.find((t) => t.type === activeTool);
    return match?.label ?? String(activeTool);
  }, [activeTool]);

  function ensureEditCanvas() {
    if (editorViewMode !== 'canvas') setEditorViewMode('canvas');
  }

  function disarmCatalog() {
    setCatalogPlacePayload(null);
    setArmedRoomPrefabId(null);
    setArmedCatalogId(null);
    setArmedCatalogLabel(null);
    setActiveTool('select');
    setNotice({ kind: 'success', text: 'ยกเลิกการวาง — กลับ Select' });
  }

  function resolveCanvasPoint(rawX: number, rawY: number) {
    const skipGrid =
      activeTool === 'door' ||
      activeTool === 'window' ||
      Boolean(catalogPlacePayload) ||
      Boolean(armedRoomPrefabId);
    return {
      x: skipGrid ? rawX : snap(rawX, gridEnabled),
      y: skipGrid ? rawY : snap(rawY, gridEnabled),
    };
  }

  function changeDefaultCamera(mode: UnifiedCameraPreset) {
    setCameraPreset(mode);
    updateSelectedGraphicLocal((graphic) => {
      const currentLayout = graphic.layout || { version: GRAPHIC_LAYOUT_VERSION_V2, objects: [] };
      return {
        ...graphic,
        layout: normalizeGraphicLayout({ ...currentLayout, defaultCamera: mode, version: GRAPHIC_LAYOUT_VERSION_V2 }),
      };
    });
    setNotice({
      kind: 'success',
      text: mode === 'flat' ? 'มุม Monitor — แก้ไขหน้าแบน' : mode === 'top' ? 'มุม Top — วาดผนัง/layout' : 'มุม Orbit — ดู 3D',
    });
  }

  function handleCatalogCategoryChange(category: CatalogStripCategory) {
    setCatalogStripCategory(category);
    if (category === 'charts') {
      setPaletteTab('values');
      if (cameraPreset !== 'flat') changeDefaultCamera('flat');
    } else if (category === 'equipment') {
      setPaletteTab('scene');
    } else if (category === 'routing') {
      setPaletteTab('sld');
    }
  }

  function armCatalogPayload(id: string, payload: SceneCatalogDropPayload, label: string) {
    ensureEditCanvas();
    setCatalogPlacePayload(payload);
    setArmedRoomPrefabId(null);
    setArmedCatalogId(id);
    setArmedCatalogLabel(label);
    setActiveTool('select');
    setNotice({ kind: 'success', text: `คลิก canvas เพื่อวาง ${label}` });
  }

  function armCatalogTool(id: string, tool: 'wire', label: string) {
    ensureEditCanvas();
    setCatalogPlacePayload(null);
    setArmedRoomPrefabId(null);
    setArmedCatalogId(id);
    setArmedCatalogLabel(label);
    setActiveTool(tool);
    setOpeningSnap(null);
    setWireFrom(null);
    setWireCursor(null);
    setNotice({ kind: 'success', text: toolHintFor(tool) });
  }

  function armCatalogPrefab(id: string, prefabId: string, label: string) {
    ensureEditCanvas();
    setCatalogPlacePayload(null);
    setArmedRoomPrefabId(prefabId);
    setArmedCatalogId(id);
    setArmedCatalogLabel(label);
    setActiveTool('select');
    setOpeningSnap(null);
    setNotice({ kind: 'success', text: `คลิก canvas เพื่อวางห้อง ${label}` });
  }

  function placeRoomPrefab(prefabId: string, cx: number, cy: number) {
    if (!selectedGraphic) return;
    const prefab = findRoomPrefab(prefabId);
    if (!prefab) {
      setNotice({ kind: 'error', text: 'Unknown room prefab.' });
      return;
    }
    const originX = clamp(snap(cx - prefab.width / 2, gridEnabled), 0, Math.max(0, selectedGraphic.width - prefab.width));
    const originY = clamp(snap(cy - prefab.height / 2, gridEnabled), 0, Math.max(0, selectedGraphic.height - prefab.height));
    try {
      const room = buildRoomFromPolygon(roomPrefabCorners(originX, originY, prefab.width, prefab.height));
      commitRoomBuild(room, { zoneLabel: prefab.zoneLabel, floorFill: prefab.floorFill });
      setArmedRoomPrefabId(null);
      setArmedCatalogId(null);
      setArmedCatalogLabel(null);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }

  function autoRouteEquipment() {
    if (!selectedGraphic) return;
    const equip = (selectedGraphic.layout?.objects ?? []).filter(
      (o) => o.visible !== false && (o.type === 'elecsymbol' || o.type === 'viewport3d'),
    );
    const order = ['transformer', 'solar', 'mdb', 'meter', 'breaker', 'motor', 'generator', 'ups', 'load'];
    const score = (o: GraphicObjectDefinition) => {
      const key = `${o.style?.symbolId ?? ''} ${o.name ?? ''}`.toLowerCase();
      const idx = order.findIndex((k) => key.includes(k));
      return idx === -1 ? 99 : idx;
    };
    const sorted = [...equip].sort((a, b) => score(a) - score(b));
    if (sorted.length < 2) {
      setNotice({ kind: 'error', text: 'ต้องมีอุปกรณ์ (elecsymbol/viewport3d) อย่างน้อย 2 ชิ้น' });
      return;
    }
    let linked = 0;
    updateLayoutObjects((objects) => {
      const next = [...objects];
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i];
        const to = sorted[i + 1];
        const fromPorts = parsePorts(from.style?.ports);
        const toPorts = parsePorts(to.style?.ports);
        const outPort = fromPorts.find((p) => p.kind === 'out') ?? fromPorts[fromPorts.length - 1];
        const inPort = toPorts.find((p) => p.kind === 'in') ?? toPorts[0];
        if (!outPort || !inPort) continue;
        try {
          const wireId = makeId('flowpath');
          const cableId = makeId('cable3d');
          const wire = createWireObject(from, outPort.id, to, inPort.id, wireId, `Wire ${from.name}-${to.name}`);
          const cable = createCable3dFromPorts(from, outPort.id, to, inPort.id, cableId, `Cable ${from.name}-${to.name}`, wireId);
          next.push(wire, cable);
          linked++;
        } catch {
          /* skip pair without ports */
        }
      }
      return next;
    });
    setNotice({
      kind: linked > 0 ? 'success' : 'error',
      text: linked > 0 ? `Auto Route: เชื่อม ${linked} คู่อุปกรณ์ (wire + cable3d)` : 'ไม่พบ port ที่เชื่อมได้',
    });
  }

  async function applyGlbPortsFromModel() {
    if (!selectedObject || !['viewport3d', 'scene3d'].includes(selectedObject.type)) return;
    const glbUrl = String(selectedObject.style?.glbUrl ?? '');
    setIsBusy(true);
    try {
      const ports = await resolveGlbPortsFromUrl(glbUrl);
      updateObject({ style: { ...selectedObject.style, ports } });
      setNotice({
        kind: 'success',
        text: glbUrl
          ? 'Ports from GLB node names (port_*/socket_*) or bbox fallback applied.'
          : 'BBox ports applied — add GLB URL to parse named ports.',
      });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  // Tags filtered by chosen binding device
  const filteredBindingTags = useMemo(
    () => (bindingDeviceId ? tags.filter((t) => t.deviceId === bindingDeviceId) : tags),
    [tags, bindingDeviceId]
  );

  async function load() {
    setIsBusy(true);
    try {
      const [graphicList, tagList, deviceList, projectList, dbStatus] = await Promise.all([
        window.energylink.graphics.list(),
        window.energylink.tags.list().catch(() => [] as TagSummary[]),
        window.energylink.devices.list().catch(() => [] as DeviceSummary[]),
        window.energylink.projects.list().catch(() => []),
        window.energylink.projects.status()
      ]);
      setGraphics(
        graphicList.map((g) => ({
          ...g,
          layout: normalizeGraphicLayout(g.layout),
        })),
      );
      setTags(tagList);
      setDevices(deviceList);
      setAssets(loadGraphicAssets());
      setSelectedGraphicId((current) =>
        current && graphicList.some((graphic) => graphic.id === current) ? current : graphicList[0]?.id || ''
      );

      const pid = dbStatus?.activeProjectId;
      if (pid) {
        const proj = projectList.find(p => p.id === pid);
        if (proj) {
          setActiveProject({ id: proj.id, name: proj.name });
        } else {
          setActiveProject(null);
        }
      } else {
        setActiveProject(null);
      }

      setNotice({ kind: 'success', text: 'Graphics, devices and tags loaded.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void load();

    function handleProjectChange() {
      void load();
    }

    window.addEventListener('energylink:active-project-changed', handleProjectChange);
    return () => window.removeEventListener('energylink:active-project-changed', handleProjectChange);
  }, []);

  // Sync bindingDeviceId when object selection changes
  useEffect(() => {
    if (selectedObject?.binding?.tagId) {
      const tag = tags.find((t) => t.id === selectedObject.binding?.tagId);
      if (tag) setBindingDeviceId(tag.deviceId);
    }
  }, [selectedObjectId]);

  useEffect(() => {
    if (!selectedGraphic) return;
    let cancelled = false;
    const loadTags = async () => {
      const res = await editorRuntimeApi.getCurrentValues();
      if (cancelled || !res.ok) return;
      const values = res.data.values ?? [];
      setEditorCurrentValues(values);
      setR3fTagValues(new Map(values.map((v) => [v.id, v])));
    };
    void loadTags();
    const timer = window.setInterval(() => void loadTags(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedGraphic?.id]);

  // Auto-dismiss success notices after 3 seconds
  useEffect(() => {
    if (notice && notice.kind === 'success') {
      const timer = setTimeout(() => {
        setNotice(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  async function createGraphic() {
    if (!newGraphic.name.trim()) {
      setNotice({ kind: 'error', text: 'Please specify graphic name.' });
      return;
    }
    if (newGraphic.width < 320 || newGraphic.height < 240) {
      setNotice({ kind: 'error', text: 'Graphic dimensions must be at least 320 × 240.' });
      return;
    }
    setIsBusy(true);
    try {
      const tpl = getGraphicTemplate(newGraphic.templateId);
      const created = await window.energylink.graphics.create({
        name: newGraphic.name.trim(),
        width: newGraphic.width || tpl.width,
        height: newGraphic.height || tpl.height,
        refreshIntervalMs: newGraphic.refreshIntervalMs,
        layout: tpl.layout(),
        isDefault: graphics.length === 0
      });
      setGraphics((items) => [created, ...items]);
      setSelectedGraphicId(created.id);
      setSelectedObjectId('');
      setPropTab(created.layout?.objects?.length ? 'canvas' : 'script');
      setNotice({
        kind: 'success',
        text: created.layout?.objects?.length
          ? 'Created new Graphic.'
          : 'สร้าง Graphic แล้ว — ไปแท็บ Script ด้านขวาเพื่อสร้างห้อง/ตู้จาก JSON',
      });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteGraphic() {
    if (!selectedGraphic) {
      setNotice({ kind: 'error', text: 'Please select a Graphic before deleting.' });
      return;
    }
    if (!await showConfirm(`Delete graphic "${selectedGraphic.name}"?`)) return;
    setIsBusy(true);
    try {
      await window.energylink.graphics.delete(selectedGraphic.id);
      await load();
      setSelectedObjectId('');
      setNotice({ kind: 'success', text: 'Graphic deleted successfully.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  function updateSelectedGraphicLocal(updater: (graphic: GraphicSummary) => GraphicSummary) {
    if (!selectedGraphic) return;
    const next = updater(selectedGraphic);
    setGraphics((items) => items.map((item) => item.id === next.id ? next : item));
  }

  function updateLayoutObjects(updater: (objects: GraphicObjectDefinition[]) => GraphicObjectDefinition[]) {
    updateSelectedGraphicLocal((graphic) => {
      const { objects, version, ...rest } = graphic.layout || {};
      return {
        ...graphic,
        layout: {
          backgroundColor: '#fbfdff',
          ...rest,
          version: 1,
          objects: updater(objects || [])
        }
      };
    });
  }

  function addObject(type: GraphicObjectType, x?: number, y?: number) {
    if (!selectedGraphic) {
      setNotice({ kind: 'error', text: 'Please select or create a Graphic before adding objects.' });
      return;
    }
    const objects = selectedGraphic.layout?.objects || [];
    if (type === 'scene3d' && objects.some((o) => o.type === 'scene3d')) {
      setNotice({ kind: 'error', text: 'Only one Full 3D Scene layer per graphic.' });
      return;
    }
    let placeX = x;
    let placeY = y;
    let wallRotation: number | undefined;
    if (placeX !== undefined && placeY !== undefined) {
      const resolved = resolvePlacementPoint(placeX, placeY, type);
      placeX = resolved.x;
      placeY = resolved.y;
      wallRotation = resolved.rotation;
    }
    const object = makeObject(
      type,
      objects.length,
      placeX !== undefined ? placeX : undefined,
      placeY !== undefined ? placeY : undefined
    );
    if (wallRotation !== undefined) {
      object.style = { ...object.style, rotation: wallRotation };
    }
    if (type === 'flowpath') {
      const h = object.height;
      const w = object.width;
      object.style = applySceneDefaultsToStyle('flowpath', {
        ...object.style,
        pathPoints: `0,${Math.round(h / 2)};${w},${Math.round(h / 2)}`,
        flowColor: '#22d3ee',
        idleColor: '#94a3b8',
        flowThreshold: 0.5,
        strokeWidth: 4,
        flowSpeed: 1,
        flowGlow: true,
        requireEnable: false,
      });
    }
    if (type === 'cable3d') {
      const h = object.height;
      const w = object.width;
      object.style = applySceneDefaultsToStyle('cable3d', {
        ...object.style,
        pathPoints: `0,${Math.round(h / 2)};${w},${Math.round(h / 2)}`,
        path3d: `0,${(h / 2).toFixed(1)},0;${w},${(h / 2).toFixed(1)},0`,
        flowColor: '#a78bfa',
        idleColor: '#64748b',
        flowThreshold: 0.5,
        strokeWidth: 6,
        flowSpeed: 1,
        cableRadius: 3,
      });
      const hostId = findViewportHost(objects, object);
      if (hostId) object.style = { ...object.style, viewportHostId: hostId };
    }
    if (type === 'pipe') {
      const h = object.height;
      const w = object.width;
      object.style = applySceneDefaultsToStyle('pipe', {
        ...object.style,
        pathPoints: `0,${Math.round(h / 2)};${w},${Math.round(h / 2)}`,
        fill: '#06b6d4',
        pipeWall: '#0e7490',
        flowColor: '#22d3ee',
        idleColor: '#64748b',
        pipeWidth: 14,
        flowThreshold: 0.5,
        flowSpeed: 1,
      });
    }
    if (type === 'elecsymbol') {
      object.style = applySceneDefaultsToStyle('elecsymbol', {
        ...object.style,
        symbolId: 'breaker',
        states: 'open,closed,trip',
        stroke: '#cbd5e1',
        ports: defaultPortsForType('elecsymbol') || DEFAULT_ELEC_PORTS,
      });
    }
    if (type === 'image') {
      object.style = applySceneDefaultsToStyle('image', {
        ...object.style,
        objectFit: 'contain',
        ports: defaultPortsForType('image') || DEFAULT_EQUIPMENT_PORTS,
      });
      (object as ExtendedObject).displayMode = 'image';
    }
    if (type === 'sprite') {
      object.style = {
        ...object.style,
        spriteUrl: '',
        frameWidth: 64,
        frameHeight: 64,
        frameCount: 8,
        columns: 8,
        fps: 12,
        playThreshold: 0.5,
        background: 'transparent',
        stroke: '#a855f7',
      };
    }
    if (type === 'lottie') {
      object.style = {
        ...object.style,
        lottieUrl: '',
        loop: true,
        autoplay: true,
        playThreshold: 0.5,
        background: 'transparent',
        stroke: '#ec4899',
      };
    }
    if (type === 'viewport3d') {
      const firstGlb = model3dAssets[0]?.url ?? '';
      object.style = applySceneDefaultsToStyle('viewport3d', {
        ...object.style,
        sceneBuildMode: firstGlb ? 'glb' : 'box',
        glbUrl: firstGlb,
        boxColor: '#64748b',
        boxDepth: 40,
        autoRotate: false,
        exposure: 1,
        cameraPreset: 'isometric',
        background: 'transparent',
        stroke: 'transparent',
        ports: defaultPortsForType('viewport3d') || DEFAULT_EQUIPMENT_PORTS,
        depthZ: snap3dEnabled ? snapDepthZ(0, true) : 0,
        viewportCableInlay: true,
      });
    }
    if (type === 'scene3d') {
      const firstGlb = model3dAssets[0]?.url ?? '';
      object.x = 0;
      object.y = 0;
      object.width = selectedGraphic.width;
      object.height = selectedGraphic.height;
      object.layer = 0;
      object.style = applySceneDefaultsToStyle('scene3d', {
        ...object.style,
        sceneBuildMode: firstGlb ? 'glb' : 'box',
        glbUrl: firstGlb,
        boxColor: '#64748b',
        boxDepth: 40,
        autoRotate: false,
        exposure: 1,
        cameraPreset: 'juddesk',
        background: 'transparent',
        stroke: 'transparent',
        viewportCableInlay: true,
      });
    }
    if (type === 'group') {
      object.style = {
        ...object.style,
        memberIds: '',
        background: 'rgba(148,163,184,0.08)',
        stroke: '#94a3b8',
      };
    }
    if (type === 'kpicard') {
      object.style = { ...object.style, background: '#f8fafc', stroke: '#0ea5e9' };
    }
    if (type === 'piechart') {
      object.style = { ...object.style, donut: false, background: '#fff', stroke: '#f97316' };
    }
    if (type === 'formulavalue') {
      object.style = { ...object.style, formula: 'A + B', decimalPlaces: 2, unit: '', background: '#fff', stroke: '#6366f1' };
    }
    if (type === 'statusbadge') {
      object.style = {
        ...object.style,
        badgeMap: '0:Stop:#94a3b8,1:Run:#22c55e,2:Fault:#ef4444',
        alarmBadgeColor: '#ef4444',
        background: 'transparent',
        stroke: '#14b8a6',
      };
    }
    if (type === 'clock') {
      object.style = {
        ...object.style,
        clockFormat: 'local',
        clockTimeStyle: '24h',
        showDate: true,
        showSeconds: true,
        fontSize: 22,
        background: '#ffffff',
        stroke: '#0ea5e9',
        textAlign: 'center',
      };
    }
    if (type === 'zone3d') {
      object.style = applySceneDefaultsToStyle('zone3d', {
        ...object.style,
        zoneLabel: object.text ?? 'Room',
        background: 'rgba(99,102,241,0.12)',
        stroke: '#6366f1',
      });
    }
    if (type === 'bussection') {
      object.style = applySceneDefaultsToStyle('bussection', {
        ...object.style,
        stroke: '#173047',
        ports: defaultPortsForType('bussection') || DEFAULT_BUS_PORTS,
      });
    }
    if (type === 'feedlabel') {
      object.style = applySceneDefaultsToStyle('feedlabel', {
        ...object.style,
        labelPrefix: object.text ?? 'Feed',
        flowColor: '#0ea5e9',
        background: 'rgba(255,255,255,0.92)',
      });
    }
    if (type === 'zone2d') {
      object.style = applySceneDefaultsToStyle('zone2d', {
        ...object.style,
        zoneLabel: object.text ?? 'Zone',
        fill: 'rgba(99,102,241,0.12)',
        stroke: '#6366f1',
        floorLevel: 0,
      });
    }
    object.x = clamp(object.x, 0, Math.max(0, selectedGraphic.width - object.width));
    object.y = clamp(object.y, 0, Math.max(0, selectedGraphic.height - object.height));
    updateLayoutObjects((items) => [...items, object]);
    setSelectedObjectId(object.id);
    if (type === 'flowpath') {
      setPathEditId(object.id);
      setNotice({ kind: 'success', text: 'Flow Path placed. Click canvas to add points · Enter to finish · Esc to cancel edit.' });
      return;
    }
    if (type === 'pipe') {
      setPathEditId(object.id);
      setNotice({ kind: 'success', text: 'Pipe placed. Drag path points in canvas · bind Flow Tag in properties.' });
      return;
    }
    setActiveTool('select');
    setNotice({ kind: 'success', text: `Added ${type} object.` });
  }

  function placeGlbViewportOnCanvas(
    name: string,
    glbUrl: string,
    x: number,
    y: number,
    realWidthMm?: number,
    realHeightMm?: number,
  ) {
    if (!selectedGraphic) return;
    const mmPerPx = selectedGraphic.layout?.sceneScaleMmPerPx ?? DEFAULT_MM_PER_PX;
    const dims = realWidthMm && realHeightMm
      ? dimensionsFromRealWorld(realWidthMm, realHeightMm, mmPerPx)
      : { width: 240, height: 240 };
    const objects = selectedGraphic.layout?.objects || [];
    const object = makeObject('viewport3d', objects.length, x, y);
    object.name = name;
    object.width = dims.width;
    object.height = dims.height;
    object.text = name;
    object.x = snap(x, gridEnabled) - dims.width / 2;
    object.y = snap(y, gridEnabled) - dims.height / 2;
    object.style = applySceneDefaultsToStyle('viewport3d', {
      ...object.style,
      sceneBuildMode: 'glb',
      glbUrl,
      autoRotate: false,
      cameraPreset: 'isometric',
      realWidthMm,
      realHeightMm,
      ports: defaultPortsForType('viewport3d') || DEFAULT_EQUIPMENT_PORTS,
    });
    object.x = clamp(object.x, 0, Math.max(0, selectedGraphic.width - object.width));
    object.y = clamp(object.y, 0, Math.max(0, selectedGraphic.height - object.height));
    updateLayoutObjects((items) => [...items, object]);
    setSelectedObjectId(object.id);
  }

  async function buildGlbFromImageAndPlace(
    name: string,
    imageDataUrl: string,
    canvasX: number,
    canvasY: number,
    realWidthMm?: number,
    realHeightMm?: number,
    glbMode?: ImageToGlbMode,
  ) {
    if (!selectedGraphic) return;
    setIsBusy(true);
    setNotice({ kind: 'success', text: 'กำลังสร้างไฟล์ GLB จากรูp... (รอ 3–10 วินาที)' });
    try {
      const mode = glbMode ?? detectGlbMode(imageDataUrl);
      const { blob, byteLength } = await imageDataUrlToGlbBlob(imageDataUrl, { mode, depthScale: 0.2, segments: 72 });
      const glbDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('อ่าน GLB ไม่ได้'));
        reader.readAsDataURL(blob);
      });
      const baseName = name.replace(/\.[^.]+$/, '') || name;
      const asset = {
        id: makeId('glb'),
        name: `${baseName}.glb`,
        kind: 'model3d' as const,
        url: glbDataUrl,
        mimeType: 'model/gltf-binary',
        fileSize: byteLength,
        createdAt: new Date().toISOString(),
        realWidthMm,
        realHeightMm,
      };
      const nextAssets = [...assets, asset];
      setAssets(nextAssets);
      saveGraphicAssets(nextAssets);
      placeGlbViewportOnCanvas(baseName, glbDataUrl, canvasX, canvasY, realWidthMm, realHeightMm);
      setNotice({
        kind: 'success',
        text: `สร้าง GLB "${baseName}.glb" แล้ว (${Math.round(byteLength / 1024)} KB) — โหมด GLB · ดูใน Live/Monitor · ไฟล์อยู่ใน Setup → Assets`,
      });
    } catch (err) {
      setNotice({
        kind: 'error',
        text: `สร้าง GLB ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsBusy(false);
    }
  }

  function placeImageOnCanvas(
    name: string,
    dataUrl: string,
    x: number,
    y: number,
    realWidthMm?: number,
    realHeightMm?: number,
  ) {
    if (!selectedGraphic) return;
    const mmPerPx = selectedGraphic.layout?.sceneScaleMmPerPx ?? DEFAULT_MM_PER_PX;
    const dims = realWidthMm && realHeightMm
      ? dimensionsFromRealWorld(realWidthMm, realHeightMm, mmPerPx)
      : { width: 200, height: 150 };
    const objects = selectedGraphic.layout?.objects || [];
    const object = makeObject('image', objects.length, x, y);
    object.name = name;
    object.width = dims.width;
    object.height = dims.height;
    object.imageDataUrl = dataUrl;
    (object as ExtendedObject).displayMode = 'image';
    object.x = snap(x, gridEnabled) - dims.width / 2;
    object.y = snap(y, gridEnabled) - dims.height / 2;
    object.style = applySceneDefaultsToStyle('image', {
      ...object.style,
      imageDataUrl: dataUrl,
      objectFit: 'contain',
      realWidthMm,
      realHeightMm,
      ports: defaultPortsForType('image') || DEFAULT_EQUIPMENT_PORTS,
    });
    object.x = clamp(object.x, 0, Math.max(0, selectedGraphic.width - object.width));
    object.y = clamp(object.y, 0, Math.max(0, selectedGraphic.height - object.height));
    updateLayoutObjects((items) => [...items, object]);
    setSelectedObjectId(object.id);
    setNotice({
      kind: 'success',
      text: `วางรูp "${name}" แล้ว — ต้องการโมเดล 3D จริง: สร้าง GLB จาก Tripo/Meshy แล้ว import ที่ Setup → Assets`,
    });
  }

  function placeImageAs3dBox(
    name: string,
    dataUrl: string,
    x: number,
    y: number,
    realWidthMm?: number,
    realHeightMm?: number,
  ) {
    if (!selectedGraphic) return;
    const mmPerPx = selectedGraphic.layout?.sceneScaleMmPerPx ?? DEFAULT_MM_PER_PX;
    const dims = realWidthMm && realHeightMm
      ? dimensionsFromRealWorld(realWidthMm, realHeightMm, mmPerPx)
      : { width: 220, height: 280 };
    const objects = selectedGraphic.layout?.objects || [];
    const object = makeObject('viewport3d', objects.length, x, y);
    object.name = name;
    object.width = dims.width;
    object.height = dims.height;
    object.text = name;
    object.x = snap(x, gridEnabled) - dims.width / 2;
    object.y = snap(y, gridEnabled) - dims.height / 2;
    object.style = applySceneDefaultsToStyle('viewport3d', {
      ...object.style,
      ...imageTo3dBoxStyle(dataUrl, dims.width, dims.height, {
        realWidthMm,
        realHeightMm,
        ports: defaultPortsForType('viewport3d') || DEFAULT_EQUIPMENT_PORTS,
      }),
    });
    object.x = clamp(object.x, 0, Math.max(0, selectedGraphic.width - object.width));
    object.y = clamp(object.y, 0, Math.max(0, selectedGraphic.height - object.height));
    updateLayoutObjects((items) => [...items, object]);
    setSelectedObjectId(object.id);
    if (!is3dCamera) setCameraPreset('orbit');
    setNotice({ kind: 'success', text: `วาง "${name}" เป็น 3D Box แล้ว — ปรับความลึกใน Properties` });
  }

  function placeSceneAsset(payload: SceneCatalogDropPayload, canvasX: number, canvasY: number) {
    if (!selectedGraphic) {
      setNotice({ kind: 'error', text: 'Please select or create a Graphic first.' });
      return;
    }
    const mmPerPx = selectedGraphic.layout?.sceneScaleMmPerPx ?? DEFAULT_MM_PER_PX;
    const x = snap(canvasX, gridEnabled);
    const y = snap(canvasY, gridEnabled);

    if (payload.kind === 'image') {
      placeImageOnCanvas(payload.name, payload.dataUrl, x, y, payload.realWidthMm, payload.realHeightMm);
      return;
    }

    if (payload.kind === 'model3d') {
      const dims = payload.realWidthMm && payload.realHeightMm
        ? dimensionsFromRealWorld(payload.realWidthMm, payload.realHeightMm, mmPerPx)
        : { width: 320, height: 240 };
      const objects = selectedGraphic.layout?.objects || [];
      const object = makeObject('viewport3d', objects.length, x, y);
      object.name = payload.name;
      object.width = dims.width;
      object.height = dims.height;
      object.style = applySceneDefaultsToStyle('viewport3d', {
        ...object.style,
        sceneBuildMode: 'glb',
        glbUrl: payload.glbUrl,
        autoRotate: false,
        cameraPreset: 'isometric',
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
        ports: defaultPortsForType('viewport3d') || DEFAULT_EQUIPMENT_PORTS,
      });
      object.x = clamp(object.x, 0, Math.max(0, selectedGraphic.width - object.width));
      object.y = clamp(object.y, 0, Math.max(0, selectedGraphic.height - object.height));
      updateLayoutObjects((items) => [...items, object]);
      setSelectedObjectId(object.id);
      setNotice({ kind: 'success', text: `Placed 3D model ${payload.name} on scene.` });
      return;
    }

    if (payload.kind === 'spline') {
      const dims = payload.realWidthMm && payload.realHeightMm
        ? dimensionsFromRealWorld(payload.realWidthMm, payload.realHeightMm, mmPerPx)
        : { width: 320, height: 240 };
      const objects = selectedGraphic.layout?.objects || [];
      const object = makeObject('viewport3d', objects.length, x, y);
      object.name = payload.name;
      object.width = dims.width;
      object.height = dims.height;
      object.style = applySceneDefaultsToStyle('viewport3d', {
        ...object.style,
        sceneBuildMode: 'spline',
        splineUrl: payload.splineUrl,
        autoRotate: false,
        cameraPreset: 'isometric',
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
        ports: defaultPortsForType('viewport3d') || DEFAULT_EQUIPMENT_PORTS,
      });
      object.x = clamp(object.x, 0, Math.max(0, selectedGraphic.width - object.width));
      object.y = clamp(object.y, 0, Math.max(0, selectedGraphic.height - object.height));
      updateLayoutObjects((items) => [...items, object]);
      setSelectedObjectId(object.id);
      setNotice({ kind: 'success', text: `Placed Spline Component ${payload.name} on scene.` });
      return;
    }

    const type = payload.type;
    const dims = payload.realWidthMm && payload.realHeightMm
      ? dimensionsFromRealWorld(payload.realWidthMm, payload.realHeightMm, mmPerPx)
      : null;
    const objects = selectedGraphic.layout?.objects || [];
    const object = makeObject(type, objects.length, x, y);
    object.name = payload.name || object.name;
    if (dims) {
      object.width = dims.width;
      object.height = dims.height;
    }
    if (payload.style) {
      object.style = {
        ...object.style,
        ...(payload.style as Record<string, string | number | boolean | undefined>),
      };
    }
    if (type === 'flowpath') {
      const h = object.height;
      const w = object.width;
      object.style = applySceneDefaultsToStyle('flowpath', {
        ...object.style,
        pathPoints: `0,${Math.round(h / 2)};${w},${Math.round(h / 2)}`,
        flowColor: '#22d3ee',
        idleColor: '#94a3b8',
        flowThreshold: 0.5,
        strokeWidth: 4,
        flowSpeed: 1,
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
      });
    } else if (type === 'pipe') {
      const h = object.height;
      const w = object.width;
      object.style = applySceneDefaultsToStyle('pipe', {
        ...object.style,
        pathPoints: `0,${Math.round(h / 2)};${w},${Math.round(h / 2)}`,
        fill: '#06b6d4',
        pipeWall: '#0e7490',
        flowColor: '#22d3ee',
        idleColor: '#64748b',
        pipeWidth: 14,
        flowThreshold: 0.5,
        flowSpeed: 1,
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
      });
    } else if (type === 'elecsymbol') {
      object.style = applySceneDefaultsToStyle('elecsymbol', {
        ...object.style,
        symbolId: payload.symbolId ?? 'breaker',
        states: 'open,closed,trip',
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
        ports: defaultPortsForType('elecsymbol') || DEFAULT_ELEC_PORTS,
      });
    } else if (type === 'image') {
      object.style = applySceneDefaultsToStyle('image', {
        ...object.style,
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
        ports: defaultPortsForType('image') || DEFAULT_EQUIPMENT_PORTS,
      });
    } else if (type === 'viewport3d') {
      const firstGlb = model3dAssets[0]?.url ?? '';
      object.style = applySceneDefaultsToStyle('viewport3d', {
        ...object.style,
        sceneBuildMode: firstGlb ? 'glb' : 'box',
        glbUrl: firstGlb,
        boxColor: '#64748b',
        boxDepth: 40,
        autoRotate: false,
        cameraPreset: 'isometric',
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
        ports: defaultPortsForType('viewport3d') || DEFAULT_EQUIPMENT_PORTS,
      });
    } else if (type === 'zone3d') {
      object.style = applySceneDefaultsToStyle('zone3d', {
        ...object.style,
        zoneLabel: payload.name ?? 'Room',
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
      });
    } else if (type === 'rectangle') {
      object.style = applySceneDefaultsToStyle('rectangle', {
        ...object.style,
        background: payload.name === 'Floor' ? '#e2e8f0' : object.style?.background,
        fill: payload.name === 'Floor' ? '#e2e8f0' : object.style?.fill,
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
      });
    } else if (type === 'panel') {
      object.style = applySceneDefaultsToStyle('panel', {
        ...object.style,
        background: payload.name === 'Wall' ? '#94a3b8' : object.style?.background,
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
      });
    } else {
      object.style = applySceneDefaultsToStyle(type, {
        ...object.style,
        realWidthMm: payload.realWidthMm,
        realHeightMm: payload.realHeightMm,
        ...(payload.symbolId ? { symbolId: payload.symbolId } : {}),
      });
    }
    object.y = clamp(object.y, 0, Math.max(0, selectedGraphic.height - object.height));
    updateLayoutObjects((items) => [...items, object]);
    setSelectedObjectId(object.id);
    if (type === 'flowpath' || type === 'cable3d' || type === 'pipe') setPathEditId(object.id);
    setActiveTool('select');
    setNotice({ kind: 'success', text: `Placed ${payload.name} on scene.` });
  }

  async function importImageFile(file: File, canvasX?: number, canvasY?: number) {
    if (assetKindFromFile(file) !== 'image') {
      setNotice({ kind: 'error', text: 'รองรับเฉพาะไฟล์รูป (PNG, JPG, SVG, …)' });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const asset = {
        id: makeId('asset'),
        name: file.name.replace(/\.[^.]+$/, '') || file.name,
        kind: 'image' as const,
        url: dataUrl,
        mimeType: file.type || undefined,
        createdAt: new Date().toISOString(),
      };
      const nextAssets = [...assets, asset];
      setAssets(nextAssets);
      saveGraphicAssets(nextAssets);
      if (selectedGraphic && canvasX !== undefined && canvasY !== undefined) {
        placeImageOnCanvas(asset.name, dataUrl, canvasX, canvasY, 800, 600);
      } else {
        setNotice({ kind: 'success', text: `เพิ่มรูป "${asset.name}" ในคลังแล้ว — ลากลง canvas ได้เลย` });
      }
    } catch {
      setNotice({ kind: 'error', text: `อ่านไฟล์ ${file.name} ไม่ได้` });
    }
  }

  async function importGlbFile(file: File, canvasX?: number, canvasY?: number) {
    const kind = assetKindFromFile(file);
    if (kind !== 'model3d') {
      setNotice({ kind: 'error', text: 'รองรับเฉพาะไฟล์ .glb / .gltf' });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const baseName = file.name.replace(/\.(glb|gltf)$/i, '') || file.name;
      const asset = {
        id: makeId('glb'),
        name: file.name,
        kind: 'model3d' as const,
        url: dataUrl,
        mimeType: file.type || 'model/gltf-binary',
        fileSize: file.size,
        createdAt: new Date().toISOString(),
      };
      const nextAssets = [...assets, asset];
      setAssets(nextAssets);
      saveGraphicAssets(nextAssets);
      if (selectedGraphic) {
        const cx = canvasX ?? (canvasRef.current ? canvasRef.current.clientWidth / 2 : 200);
        const cy = canvasY ?? (canvasRef.current ? canvasRef.current.clientHeight / 2 : 200);
        placeGlbViewportOnCanvas(baseName, dataUrl, cx, cy);
        setNotice({ kind: 'success', text: `Import GLB "${file.name}" — กด Live หมุนดูโมเดล 3D จริง` });
      } else {
        setNotice({ kind: 'success', text: `เพิ่ม GLB "${file.name}" ใน Assets (Setup → Assets)` });
      }
    } catch {
      setNotice({ kind: 'error', text: `อ่าน ${file.name} ไม่ได้` });
    }
  }

  async function runSceneScript(json: string, mode: 'replace' | 'merge') {
    if (!selectedGraphic) return;
    const parsed = parseSceneScript(json);
    if (!parsed.ok) {
      setNotice({ kind: 'error', text: parsed.error });
      return;
    }
    setIsBusy(true);
    setNotice({ kind: 'success', text: 'กำลังสร้าง GLB + layout จากสคริป…' });
    try {
      const result = await buildSceneFromScript(parsed.script, makeId);
      if (result.newAssets.length > 0) {
        const nextAssets = [...assets, ...result.newAssets];
        setAssets(nextAssets);
        saveGraphicAssets(nextAssets);
      }
      const mmPerPx = parsed.script.mmPerPx ?? selectedGraphic.layout?.sceneScaleMmPerPx ?? DEFAULT_MM_PER_PX;
      updateSelectedGraphicLocal((g) => {
        const base = g.layout ?? { version: 1 as const, backgroundColor: '#e8eef2', objects: [] };
        return {
          ...g,
          layout: {
            ...base,
            sceneScaleMmPerPx: mmPerPx,
            defaultCamera: base.defaultCamera ?? 'flat',
            version: GRAPHIC_LAYOUT_VERSION_V2,
            objects: mode === 'merge' ? [...(base.objects ?? []), ...result.objects] : result.objects,
          },
        };
      });
      setSelectedObjectId('');
      setCameraPreset('flat');
      window.setTimeout(() => fitCanvasZoom(), 80);
      const warnText = result.warnings.length ? ` คำเตือน: ${result.warnings.slice(0, 2).join('; ')}` : '';
      setNotice({
        kind: result.warnings.length ? 'error' : 'success',
        text: `สคริปสำเร็จ — ${result.objects.length} objects, ${result.newAssets.length} GLB. กด Live Preview เมื่อต้องการดู 3D${warnText}`,
      });
    } catch (e) {
      setNotice({ kind: 'error', text: `สคริปล้มเหลว: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsBusy(false);
    }
  }

  function downloadBlenderMccScript() {
    const blob = new Blob([BLENDER_MCC_PYTHON], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcc_cabinet.py';
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'success', text: 'ดาวน์โหลด mcc_cabinet.py — เปิดใน Blender แล้ว export GLB' });
  }

  function onCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!selectedGraphic || !canvasRef.current) return;
    ensureEditCanvas();
    const { x, y } = canvasPointFromClient(event.clientX, event.clientY);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      const kind = assetKindFromFile(file);
      if (kind === 'image') {
        void importImageFile(file, x, y);
        return;
      }
      if (kind === 'model3d') {
        void importGlbFile(file, x, y);
        return;
      }
    }

    const raw = event.dataTransfer.getData(SCENE_CATALOG_MIME);
    const payload = parseSceneCatalogDrop(raw);
    if (!payload) return;
    placeSceneAsset(payload, x, y);
  }

  function updateObject(patch: Partial<GraphicObjectDefinition & ObjectDisplayExtra>) {
    if (!selectedGraphic || !selectedObject) return;
    const nextPatch = { ...patch };
    if (nextPatch.x !== undefined) nextPatch.x = clamp(snap(nextPatch.x, gridEnabled), 0, selectedGraphic.width - selectedObject.width);
    if (nextPatch.y !== undefined) nextPatch.y = clamp(snap(nextPatch.y, gridEnabled), 0, selectedGraphic.height - selectedObject.height);
    if (nextPatch.width !== undefined) nextPatch.width = Math.max(MIN_OBJECT_SIZE, Number(nextPatch.width));
    if (nextPatch.height !== undefined) nextPatch.height = Math.max(MIN_OBJECT_SIZE, Number(nextPatch.height));

    if (nextPatch.style?.boxDepth !== undefined) {
      const w = Number(nextPatch.width ?? selectedObject.width);
      const h = Number(nextPatch.height ?? selectedObject.height);
      nextPatch.style = {
        ...nextPatch.style,
        boxDepth: clampBoxDepth(Number(nextPatch.style.boxDepth), w, h),
      };
    }

    updateLayoutObjects((objects) => objects.map((object) => object.id === selectedObject.id ? { ...object, ...nextPatch } : object));
  }

  function deleteObject() {
    if (!selectedGraphic || !selectedObject) {
      setNotice({ kind: 'error', text: 'Please select an Object to delete.' });
      return;
    }
    updateLayoutObjects((objects) => objects.filter((object) => object.id !== selectedObject.id));
    setSelectedObjectId('');
    setNotice({ kind: 'success', text: 'Object deleted successfully.' });
  }

  function duplicateObject() {
    if (!selectedGraphic || !selectedObject) {
      setNotice({ kind: 'error', text: 'Please select an Object to duplicate.' });
      return;
    }
    const copy: GraphicObjectDefinition = {
      ...selectedObject,
      id: makeId(selectedObject.type),
      name: `${selectedObject.name}_copy`,
      x: clamp(selectedObject.x + GRID_SIZE, 0, selectedGraphic.width - selectedObject.width),
      y: clamp(selectedObject.y + GRID_SIZE, 0, selectedGraphic.height - selectedObject.height),
      layer: Date.now()
    };
    updateLayoutObjects((objects) => [...objects, copy]);
    setSelectedObjectId(copy.id);
    setNotice({ kind: 'success', text: 'Duplicated object.' });
  }

  function bringForward() {
    if (!selectedObject) return;
    updateObject({ layer: Date.now() });
  }

  function sendBackward() {
    if (!selectedObject) return;
    updateObject({ layer: 0 });
  }

  function toggleVisibleById(id: string) {
    updateLayoutObjects((objects) =>
      objects.map((object) => (object.id === id ? { ...object, visible: object.visible === false } : object))
    );
  }

  function moveLayerById(id: string, direction: 'up' | 'down') {
    if (!selectedGraphic) return;
    const sorted = [...(selectedGraphic.layout?.objects || [])].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
    const idx = sorted.findIndex((object) => object.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const aLayer = sorted[idx].layer ?? idx;
    const bLayer = sorted[swapIdx].layer ?? swapIdx;
    const aId = sorted[idx].id;
    const bId = sorted[swapIdx].id;
    updateLayoutObjects((objects) =>
      objects.map((object) => {
        if (object.id === aId) return { ...object, layer: bLayer };
        if (object.id === bId) return { ...object, layer: aLayer };
        return object;
      })
    );
  }

  function alignSelected(direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    if (!selectedGraphic || !selectedObject) {
      setNotice({ kind: 'error', text: 'Please select an Object to align.' });
      return;
    }
    if (direction === 'left') updateObject({ x: 0 });
    if (direction === 'center') updateObject({ x: Math.round((selectedGraphic.width - selectedObject.width) / 2) });
    if (direction === 'right') updateObject({ x: selectedGraphic.width - selectedObject.width });
    if (direction === 'top') updateObject({ y: 0 });
    if (direction === 'middle') updateObject({ y: Math.round((selectedGraphic.height - selectedObject.height) / 2) });
    if (direction === 'bottom') updateObject({ y: selectedGraphic.height - selectedObject.height });
  }

  async function saveGraphic() {
    if (!selectedGraphic) {
      setNotice({ kind: 'error', text: 'Please select a Graphic before saving.' });
      return;
    }
    const { hardErrors, warnings } = validateGraphic(selectedGraphic);
    if (hardErrors.length > 0) {
      setNotice({ kind: 'error', text: `Cannot save: ${hardErrors.slice(0, 3).join(', ')}` });
      return;
    }
    setIsBusy(true);
    try {
      const layout: GraphicLayout = normalizeGraphicLayout({
        version: GRAPHIC_LAYOUT_VERSION_V2,
        backgroundColor: selectedGraphic.layout?.backgroundColor ?? '#fbfdff',
        backgroundImage: selectedGraphic.layout?.backgroundImage ?? null,
        sceneScaleMmPerPx: selectedGraphic.layout?.sceneScaleMmPerPx,
        defaultCamera: cameraPreset,
        objects: normalizeLayoutForSave(selectedGraphic.layout?.objects || []) as GraphicObjectDefinition[],
      });
      const saved = await window.energylink.graphics.update({
        id: selectedGraphic.id,
        name: selectedGraphic.name.trim(),
        description: selectedGraphic.description,
        width: selectedGraphic.width,
        height: selectedGraphic.height,
        refreshIntervalMs: selectedGraphic.refreshIntervalMs,
        isDefault: selectedGraphic.isDefault,
        layout
      });
      setGraphics((items) => items.map((item) => item.id === saved.id ? saved : item));
      const history = await window.energylink.graphics.listHistory(saved.id);
      setSnapshots(history);
      setNotice({
        kind: 'success',
        text: warnings.length > 0
          ? `Saved. ${warnings.length} warning(s) — กด Validate เพื่อดู`
          : 'Graphic saved successfully.',
      });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function setDefaultGraphic() {
    if (!selectedGraphic) {
      setNotice({ kind: 'error', text: 'Please select a Graphic to set as default.' });
      return;
    }
    setIsBusy(true);
    try {
      const saved = await window.energylink.graphics.update({ id: selectedGraphic.id, isDefault: true });
      setGraphics((items) => items.map((item) => ({ ...item, isDefault: item.id === saved.id })));
      setNotice({ kind: 'success', text: 'Set as default runtime graphic.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  function validateCurrentGraphic() {
    if (!selectedGraphic) {
      setNotice({ kind: 'error', text: 'No graphic selected.' });
      return;
    }
    const { hardErrors, warnings } = validateGraphic(selectedGraphic);
    if (hardErrors.length === 0 && warnings.length === 0) {
      setNotice({ kind: 'success', text: 'Validation passed — พร้อมรัน Monitor' });
      return;
    }
    const parts = [...hardErrors.map((e) => `❌ ${e}`), ...warnings.map((w) => `⚠ ${w}`)];
    setNotice({
      kind: hardErrors.length > 0 ? 'error' : 'success',
      text: parts.slice(0, 8).join(' · ') + (parts.length > 8 ? ` … +${parts.length - 8} more` : ''),
    });
  }

  function exportGraphic() {
    if (!selectedGraphic) {
      setNotice({ kind: 'error', text: 'Please select a Graphic before exporting.' });
      return;
    }
    const bundle = buildAssetBundleFromLibrary(selectedGraphic.layout, assets);
    const pkg = buildGraphicExportPackage(selectedGraphic, undefined, bundle);
    downloadJson(`${selectedGraphic.name.replace(/[^a-z0-9_-]+/gi, '_')}.graphic.json`, pkg);
    setNotice({ kind: 'success', text: 'Graphic package exported (.graphic.json).' });
  }

  async function importGraphicFile(file: File) {
    if (!activeProject) {
      setNotice({ kind: 'error', text: 'Select an active project before importing.' });
      return;
    }
    setIsBusy(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const parsed = parseGraphicImportPackage(raw);
      if (!parsed.ok) {
        setNotice({ kind: 'error', text: parsed.errors.join(' | ') });
        return;
      }
      const warningText = parsed.warnings.length ? ` (${parsed.warnings.join('; ')})` : '';
      const mode = selectedGraphic ? 'merge' : 'create';
      const confirmMsg = mode === 'merge'
        ? `Replace layout of "${selectedGraphic!.name}" with "${parsed.package.graphic.name}"?${warningText}`
        : `Create new graphic "${parsed.package.graphic.name}" from package?${warningText}`;
      const confirmed = await showConfirm(confirmMsg);
      if (!confirmed) return;

      if (parsed.package.assets?.assets?.length) {
        const mergedAssets = [...assets];
        for (const asset of parsed.package.assets.assets) {
          if (!mergedAssets.some((a) => a.id === asset.id || a.url === asset.url)) {
            mergedAssets.unshift(asset);
          }
        }
        saveGraphicAssets(mergedAssets);
        setAssets(mergedAssets);
      }

      const layoutWithAssets = applyAssetBundleToLayout(parsed.package.graphic.layout, parsed.package.assets);

      if (mode === 'merge' && selectedGraphic) {
        const merged = applyGraphicPackageToSummary(
          { ...selectedGraphic, layout: layoutWithAssets },
          { ...parsed.package, graphic: { ...parsed.package.graphic, layout: layoutWithAssets } },
        );
        updateSelectedGraphicLocal(() => merged);
        setSelectedObjectId('');
        setNotice({ kind: 'success', text: 'Layout imported. Save to persist changes.' });
      } else {
        const input = graphicPackageToCreateInput(
          { ...parsed.package, graphic: { ...parsed.package.graphic, layout: layoutWithAssets } },
          { projectId: activeProject.id },
        );
        const created = await window.energylink.graphics.create(input);
        setGraphics((items) => [created, ...items]);
        setSelectedGraphicId(created.id);
        setSnapshots(await window.energylink.graphics.listHistory(created.id));
        setNotice({ kind: 'success', text: `Imported graphic "${created.name}".` });
      }
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function restoreSnapshot(snapshot: GraphicLayoutSnapshot) {
    if (!selectedGraphic) return;
    setIsBusy(true);
    try {
      const restored = await window.energylink.graphics.restoreHistory(selectedGraphic.id, snapshot.id);
      setGraphics((items) => items.map((item) => (item.id === restored.id ? restored : item)));
      setSnapshots(await window.energylink.graphics.listHistory(restored.id));
    setSelectedObjectId('');
      setNotice({ kind: 'success', text: `Restored layout from ${new Date(snapshot.savedAt).toLocaleString()}.` });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsBusy(false);
    }
  }

  async function removeSnapshot(snapshotId: string) {
    if (!selectedGraphicId) return;
    try {
      const next = await window.energylink.graphics.deleteHistory(selectedGraphicId, snapshotId);
      setSnapshots(next);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }

  function bindFlowTag(tagId: string) {
    const tag = tags.find((item) => item.id === tagId);
    updateObject({
      binding: {
        ...(selectedObject?.binding ?? {}),
        flowTagId: tag ? tag.id : null,
        tagId: tag?.id ?? null,
        tagName: tag?.name,
        unit: tag?.unit,
        decimalPlaces: tag?.decimalPlaces,
      },
    } as Partial<ExtendedObject>);
  }

  function bindEnableTag(tagId: string) {
    const tag = tags.find((item) => item.id === tagId);
    updateObject({
      binding: {
        ...(selectedObject?.binding ?? {}),
        enableTagId: tag ? tag.id : null,
      },
    } as Partial<ExtendedObject>);
  }

  /** Bind a tag by tagId, also resetting imageDataUrl if needed */
  function bindSelectedTag(tagId: string) {
    const tag = tags.find((item) => item.id === tagId);
    updateObject({ binding: tag ? { tagId: tag.id, tagName: tag.name, unit: tag.unit, decimalPlaces: tag.decimalPlaces } : { tagId: null } });
  }

  /** Set display mode (text / image) on the selected object */
  function setDisplayMode(mode: DisplayMode) {
    updateObject({ displayMode: mode } as Partial<GraphicObjectDefinition & ObjectDisplayExtra>);
  }

  /** Pick an image from the library */
  function pickImage(imageId: string) {
    const img = images.find((i) => i.id === imageId);
    if (!img || !selectedObject) return;
    const patch = imageObjectPatch(img.dataUrl, img.id);
    updateObject({
      ...patch,
      style: { ...selectedObject.style, ...patch.style },
    } as Partial<GraphicObjectDefinition & ObjectDisplayExtra>);
    setNotice({ kind: 'success', text: `เลือกรูป: "${img.name}"` });
  }

  async function convertSelectedImageToGlb(glbMode?: ImageToGlbMode) {
    if (!selectedGraphic || !selectedObject) return;
    const url = resolveImageUrl(selectedObject);
    if (!url) {
      setNotice({ kind: 'error', text: 'เลือกรูpที่มีไฟล์ก่อน' });
      return;
    }
    const cx = selectedObject.x + selectedObject.width / 2;
    const cy = selectedObject.y + selectedObject.height / 2;
    await buildGlbFromImageAndPlace(
      selectedObject.name || 'model',
      url,
      cx,
      cy,
      Number(selectedObject.style?.realWidthMm) || undefined,
      Number(selectedObject.style?.realHeightMm) || undefined,
      glbMode,
    );
  }

  function convertSelectedImageTo3dBox() {
    if (!selectedGraphic || !selectedObject) return;
    const url = resolveImageUrl(selectedObject);
    if (!url) {
      setNotice({ kind: 'error', text: 'เลือกรูปก่อน หรือวางรูปลง canvas' });
      return;
    }
    const objects = selectedGraphic.layout?.objects || [];
    const box = makeObject('viewport3d', objects.length, selectedObject.x, selectedObject.y);
    box.name = `${selectedObject.name} (3D)`;
    box.width = selectedObject.width;
    box.height = selectedObject.height;
    box.text = selectedObject.text || selectedObject.name;
    box.style = applySceneDefaultsToStyle('viewport3d', {
      ...selectedObject.style,
      ...imageTo3dBoxStyle(url, selectedObject.width, selectedObject.height),
      ports: selectedObject.style?.ports ?? defaultPortsForType('viewport3d') ?? DEFAULT_EQUIPMENT_PORTS,
    });
    updateLayoutObjects((items) => [...items, box]);
    setSelectedObjectId(box.id);
    setNotice({ kind: 'success', text: 'แปลงรูปเป็น 3D Box แล้ว — ปรับความลึก (Z) ใน Properties' });
  }

  function bindFirstAvailableTag() {
    if (!selectedObject) {
      setNotice({ kind: 'error', text: 'Select an Object before binding tag.' });
      return;
    }
    const firstTag = tags[0];
    if (!firstTag) {
      setNotice({ kind: 'error', text: 'No tags available. Please create tags under Devices first.' });
      return;
    }
    bindSelectedTag(firstTag.id);
    setNotice({ kind: 'success', text: `Bound Tag to Object: ${firstTag.name}` });
  }

  function cycleCanvasZoom() {
    const idx = CANVAS_ZOOM_LEVELS.findIndex((z) => z === canvasZoom);
    const next = CANVAS_ZOOM_LEVELS[(idx + 1) % CANVAS_ZOOM_LEVELS.length];
    setCanvasZoom(next);
    setNotice({ kind: 'success', text: `Canvas zoom ${Math.round(next * 100)}%` });
  }

  function fitCanvasZoom() {
    if (!canvasScrollRef.current || !selectedGraphic) return;
    const rect = canvasScrollRef.current.getBoundingClientRect();
    const pad = 24;
    const zw = (rect.width - pad) / selectedGraphic.width;
    const zh = (rect.height - pad) / selectedGraphic.height;
    const next = Math.max(0.25, Math.min(4, Math.min(zw, zh)));
    setCanvasZoom(Number(next.toFixed(2)));
    setNotice({ kind: 'success', text: `Fit zoom ${Math.round(next * 100)}%` });
  }

  function canvasPointFromClient(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left) / canvasZoom,
      y: (clientY - rect.top) / canvasZoom,
    };
  }

  function wallSegmentsInLayout() {
    const objects = selectedGraphic?.layout?.objects ?? [];
    const walls = objects.filter((o) => o.type === 'wall');
    const segments = extractWallSegmentsFromStyles(walls);
    for (const obj of objects) {
      if (obj.visible === false) continue;
      if (obj.type !== 'panel' && obj.type !== 'rectangle') continue;
      if (obj.style?.openingKind) continue;
      const midX = obj.x + obj.width / 2;
      const midY = obj.y + obj.height / 2;
      if (obj.width >= obj.height * 2.5) {
        segments.push({ start: { x: obj.x, y: midY }, end: { x: obj.x + obj.width, y: midY } });
      } else if (obj.height >= obj.width * 2.5) {
        segments.push({ start: { x: midX, y: obj.y }, end: { x: midX, y: obj.y + obj.height } });
      }
    }
    return segments;
  }

  function placeOpeningOnWall(kind: 'door' | 'window', cx: number, cy: number) {
    if (!selectedGraphic) return;
    const snap = snapPointToWall({ x: cx, y: cy }, wallSegmentsInLayout(), 32);
    if (!snap) {
      setNotice({ kind: 'error', text: 'คลิกใกล้ผนังเพื่อวางประตู/หน้าต่าง' });
      return;
    }
    const objects = selectedGraphic.layout?.objects || [];
    if (kind === 'door') {
      const w = 48;
      const h = 80;
      const obj = makeObject('elecsymbol', objects.length, snap.point.x - w / 2, snap.point.y - h / 2);
      obj.width = w;
      obj.height = h;
      obj.name = 'Door';
      obj.style = applySceneDefaultsToStyle('elecsymbol', {
        ...obj.style,
        symbolId: 'door',
        rotation: snap.angleDeg,
        renderMode: 'scene',
        openingKind: 'door',
        wallHostAngle: snap.angleDeg,
      });
      updateLayoutObjects((items) => [...items, obj]);
      setSelectedObjectId(obj.id);
    } else {
      const w = 56;
      const h = 20;
      const obj = makeObject('rectangle', objects.length, snap.point.x - w / 2, snap.point.y - h / 2);
      obj.width = w;
      obj.height = h;
      obj.name = 'Window';
      obj.style = applySceneDefaultsToStyle('rectangle', {
        ...obj.style,
        background: 'transparent',
        fill: 'rgba(88,166,255,0.35)',
        stroke: '#58a6ff',
        strokeWidth: 2,
        rotation: snap.angleDeg,
        renderMode: 'scene',
        openingKind: 'window',
        wallHostAngle: snap.angleDeg,
      });
      updateLayoutObjects((items) => [...items, obj]);
      setSelectedObjectId(obj.id);
    }
    setOpeningSnap(null);
    setNotice({ kind: 'success', text: kind === 'door' ? 'Door placed on wall.' : 'Window placed on wall.' });
  }

  function resolvePlacementPoint(x: number, y: number, objectType?: string) {
    if (!objectType || !EQUIPMENT_WALL_SNAP_TYPES.has(objectType)) {
      return { x: snap(x, gridEnabled), y: snap(y, gridEnabled) };
    }
    const wallHit = snapPointToWall({ x, y }, wallSegmentsInLayout());
    if (!wallHit) {
      return { x: snap(x, gridEnabled), y: snap(y, gridEnabled) };
    }
    return { x: wallHit.point.x, y: wallHit.point.y, rotation: wallHit.angleDeg };
  }

  function commitRoomBuild(
    room: ReturnType<typeof buildRoomFromCorners>,
    opts?: { skipWalls?: boolean; zoneLabel?: string; floorFill?: string },
  ) {
    if (!selectedGraphic) return;
    const objects = selectedGraphic.layout?.objects || [];
    const floorFill = opts?.floorFill ?? '#e2e8f0';
    const zoneLabel = opts?.zoneLabel ?? 'Room';
    const floor = makeObject('rectangle', objects.length, room.bounds.x, room.bounds.y);
    floor.name = `Room_Floor_${floor.id.slice(-6)}`;
    floor.width = room.bounds.width;
    floor.height = room.bounds.height;
    floor.style = applySceneDefaultsToStyle('rectangle', {
      ...floor.style,
      background: floorFill,
      fill: floorFill,
      stroke: '#94a3b8',
      strokeWidth: 1,
      renderMode: 'scene',
    });

    const zone = makeObject('zone3d', objects.length + 1, room.bounds.x, room.bounds.y);
    zone.name = `Room_Zone_${zone.id.slice(-6)}`;
    zone.width = room.bounds.width;
    zone.height = room.bounds.height;
    zone.text = zoneLabel;
    zone.style = applySceneDefaultsToStyle('zone3d', {
      ...zone.style,
      zoneLabel,
      polygonPoints: room.polygonPoints,
      renderMode: 'scene',
      depthZ: snap3dEnabled ? snapDepthZ(0, true) : 0,
    });

    const wallObjects = room.walls.map((segment, index) => {
      const wall = makeObject('wall', objects.length + 2 + index, segment.x, segment.y);
      wall.width = segment.width;
      wall.height = segment.height;
      wall.style = {
        ...wall.style,
        background: '#94a3b8',
        fill: '#94a3b8',
        stroke: '#64748b',
        strokeWidth: 1,
        wallHeight3d: 80,
        wallThickness: segment.wallThickness,
        wallAngleDeg: segment.angleDeg,
        wallStartX: segment.wallStartX,
        wallStartY: segment.wallStartY,
        wallEndX: segment.wallEndX,
        wallEndY: segment.wallEndY,
        renderMode: 'scene',
      };
      return wall;
    });

    const additions = opts?.skipWalls ? [floor, zone] : [floor, zone, ...wallObjects];
    updateLayoutObjects((items) => [...items, ...additions]);
    setSelectedObjectId(zone.id);
    setRoomPoints([]);
    setActiveTool('select');
    setNotice({
      kind: 'success',
      text: opts?.skipWalls
        ? 'Room zone + floor detected from existing walls.'
        : `Room created — floor, zone, and ${wallObjects.length} walls added.`,
    });
  }

  function finalizeRoomFromCorners(points: Array<{ x: number; y: number }>) {
    try {
      const room = buildRoomFromCorners(points);
      commitRoomBuild(room);
    } catch (error) {
      setRoomPoints([]);
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }

  function finalizeRoomFromPolygonPoints(points: Array<{ x: number; y: number }>) {
    try {
      const room = buildRoomFromPolygon(points);
      commitRoomBuild(room);
    } catch (error) {
      setRoomPoints([]);
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }

  function detectRoomFromWalls() {
    if (!selectedGraphic) return;
    const segments = wallSegmentsInLayout();
    const room = buildRoomFromWallLoop(segments);
    if (!room) {
      setNotice({ kind: 'error', text: 'No closed wall loop found — draw connected walls first.' });
      return;
    }
    commitRoomBuild(room, { skipWalls: true });
  }

  function ungroupSelected() {
    if (!selectedGraphic || !selectedObject || selectedObject.type !== 'group') {
      setNotice({ kind: 'error', text: 'Select a group to ungroup.' });
      return;
    }
    const memberIds = getGroupMemberIds(selectedObject);
    updateLayoutObjects((objects) => objects.filter((o) => o.id !== selectedObject.id));
    setSelectedObjectId(memberIds[0] ?? '');
    setNotice({ kind: 'success', text: `Ungrouped — ${memberIds.length} member(s) kept on canvas.` });
  }

  function publishGraphicPackage() {
    exportGraphic();
    setNotice({ kind: 'success', text: 'Published package (.graphic.json) — import in Monitor or Web Viewer.' });
  }

  function handleCanvasPointAt(cx: number, cy: number) {
    if (!selectedGraphic) return;

    if (armedRoomPrefabId) {
      placeRoomPrefab(armedRoomPrefabId, cx, cy);
      return;
    }

    if (catalogPlacePayload) {
      placeSceneAsset(catalogPlacePayload, cx, cy);
      setCatalogPlacePayload(null);
      setArmedCatalogId(null);
      setArmedCatalogLabel(null);
      return;
    }

    if (wireFrom && snapWirePort) {
      handlePortClick(snapWirePort.objectId, snapWirePort.port);
      return;
    }

    if (activeTool === 'measure') {
      const next = [...measurePoints, { x: cx, y: cy }];
      if (next.length < 2) {
        setMeasurePoints(next);
        setNotice({ kind: 'success', text: next.length === 1 ? 'Measure: click second point.' : 'Measure ready.' });
      } else {
        const dist = Math.round(Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y));
        setNotice({ kind: 'success', text: `Distance: ${dist}px` });
        setMeasurePoints([]);
      }
      return;
    }

    if (pathEditId) {
      const target = selectedGraphic.layout?.objects?.find((o) => o.id === pathEditId);
      if (!target || (target.type !== 'flowpath' && target.type !== 'cable3d')) {
        setPathEditId(null);
        return;
      }
      const lx = cx - target.x;
      const ly = cy - target.y;
      const current = String(target.style?.pathPoints ?? '');
      const next = current ? `${current};${lx},${ly}` : `${lx},${ly}`;
      updateLayoutObjects((objects) =>
        objects.map((o) => (o.id === pathEditId ? { ...o, style: { ...o.style, pathPoints: next } } : o)),
      );
      setNotice({ kind: 'success', text: `Path point added (${lx}, ${ly}). Press Enter to finish.` });
      return;
    }

    if (activeTool === 'room') {
      if (roomPoints.length >= MIN_ROOM_CORNERS) {
        const closeDist = Math.hypot(roomPoints[0].x - cx, roomPoints[0].y - cy);
        if (closeDist <= 16) {
          finalizeRoomFromPolygonPoints(roomPoints);
          return;
        }
      }
      const next = [...roomPoints, { x: cx, y: cy }];
      if (next.length < ROOM_CORNER_COUNT) {
        setRoomPoints(next);
        setNotice({
          kind: 'success',
          text: `Room corner ${next.length} — click next corner, near first to close, or Enter (${MIN_ROOM_CORNERS}+).`,
        });
      } else {
        finalizeRoomFromCorners(next);
      }
      return;
    }

    // Wall tool: 2-click drawing — first click sets start, second click creates wall
    if (activeTool === 'wall') {
      if (!wallStart) {
        setWallStart({ x: cx, y: cy });
        setNotice({ kind: 'success', text: 'Wall start set — click again to place wall end point. Press Escape to cancel.' });
      } else {
        const segment = computeWallSegment(wallStart, { x: cx, y: cy });
        const objects = selectedGraphic.layout?.objects || [];
        const obj = makeObject('wall', objects.length, segment.x, segment.y);
        obj.width = segment.width;
        obj.height = segment.height;
        obj.style = {
          ...obj.style,
          background: '#94a3b8',
          fill: '#94a3b8',
          stroke: '#64748b',
          strokeWidth: 1,
          wallHeight3d: 80,
          wallThickness: segment.wallThickness,
          wallAngleDeg: segment.angleDeg,
          wallStartX: segment.wallStartX,
          wallStartY: segment.wallStartY,
          wallEndX: segment.wallEndX,
          wallEndY: segment.wallEndY,
          renderMode: 'scene',
        };
        updateLayoutObjects((items) => [...items, obj]);
        setSelectedObjectId(obj.id);
        setWallStart({ x: segment.wallEndX, y: segment.wallEndY });
        setWallCursor({ x: segment.wallEndX, y: segment.wallEndY });
        setNotice({ kind: 'success', text: `Wall added (${segment.len}px). Chain continues — Escape to stop.` });
      }
      return;
    }

    if (activeTool === 'door' || activeTool === 'window') {
      placeOpeningOnWall(activeTool, cx, cy);
      return;
    }

    if (activeTool === 'select') return;
    if (activeTool === 'wire' || activeTool === 'cable3d') {
      setNotice({ kind: 'success', text: toolHintFor(activeTool) });
      return;
    }
    if (activeTool === 'image') {
      imageFileInputRef.current?.click();
      return;
    }
    if (activeTool === 'pan' && panState) {
      setPanState(null);
      return;
    }
    addObject(activeTool as GraphicObjectType, cx, cy);
  }

  function onCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!selectedGraphic || editorViewMode !== 'canvas') return;
    const raw = canvasPointFromClient(event.clientX, event.clientY);
    const point = resolveCanvasPoint(raw.x, raw.y);
    handleCanvasPointAt(point.x, point.y);
  }

  function syncSelectedCableFromWire() {
    if (!selectedObject || selectedObject.type !== 'cable3d') return;
    updateLayoutObjects((objects) => syncCableFromLinkedWire(objects, selectedObject.id));
    setNotice({ kind: 'success', text: 'Cable 3D path synced from linked wire.' });
  }

  function updatePathPoints(objectId: string, points: Array<{ x: number; y: number }>) {
    updateLayoutObjects((objects) =>
      objects.map((o) => (o.id === objectId ? { ...o, style: { ...o.style, pathPoints: formatPathPoints(points) } } : o)),
    );
  }

  function makeCompositeFromSelection() {
    if (!selectedGraphic || !selectedObject) return;
    const group = makeObject('group', selectedGraphic.layout?.objects?.length ?? 0, selectedObject.x - 8, selectedObject.y - 8);
    group.width = selectedObject.width + 16;
    group.height = selectedObject.height + 16;
    group.style = {
      ...group.style,
      composite: true,
      memberIds: formatMemberIds([selectedObject.id]),
      ports: (selectedObject.style?.ports as string | undefined) ?? defaultPortsForType('elecsymbol') ?? DEFAULT_ELEC_PORTS,
    };
    updateLayoutObjects((objects) => [...objects, group]);
    setSelectedObjectId(group.id);
    setNotice({ kind: 'success', text: 'Created composite equipment group with shared ports.' });
  }

  function wrapSelectionInGroup() {
    if (!selectedGraphic || !selectedObject) return;
    const group = makeObject('group', selectedGraphic.layout?.objects?.length ?? 0, selectedObject.x - 8, selectedObject.y - 8);
    group.width = selectedObject.width + 16;
    group.height = selectedObject.height + 16;
    group.style = { ...group.style, memberIds: formatMemberIds([selectedObject.id]) };
    updateLayoutObjects((objects) => [...objects, group]);
    setSelectedObjectId(group.id);
    setNotice({ kind: 'success', text: 'Created group around selected object.' });
  }

  function getGroupMemberIds(object: GraphicObjectDefinition): string[] {
    if (object.type !== 'group') return [];
    return parseMemberIds(object.style?.memberIds);
  }

  function startDrag(event: React.MouseEvent<HTMLButtonElement>, object: GraphicObjectDefinition) {
    if ((event.target as HTMLElement).closest('.editor-flowpath-handle')) return;
    if ((event.target as HTMLElement).closest('.editor-resize-handle')) return;
    if ((event.target as HTMLElement).closest('.editor-port-handle')) return;
    if (object.type === 'scene3d') return;
    event.stopPropagation();
    setSelectedObjectId(object.id);
    if (object.locked) return;
    setDragState({
      objectId: object.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: object.x,
      originY: object.y,
      memberIds: object.type === 'group' ? getGroupMemberIds(object) : undefined,
    });
  }

  function startResize(event: React.MouseEvent<HTMLDivElement>, object: GraphicObjectDefinition) {
    event.stopPropagation();
    event.preventDefault();
    if (object.locked || object.type === 'scene3d') return;
    setResizeState({
      objectId: object.id,
      corner: 'se',
      startX: event.clientX,
      startY: event.clientY,
      originW: object.width,
      originH: object.height,
    });
  }
  function moveDrag(event: React.MouseEvent<HTMLDivElement>) {
    if (panState && canvasScrollRef.current) {
      canvasScrollRef.current.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
      canvasScrollRef.current.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
      return;
    }
    if (wireFrom && canvasRef.current) {
      const raw = canvasPointFromClient(event.clientX, event.clientY);
      const objects = selectedGraphic?.layout?.objects ?? [];
      const near = findNearestPort(objects, raw, { kind: 'in' });
      if (near) {
        setWireCursor({ x: near.x, y: near.y });
        setSnapWirePort({ objectId: near.objectId, port: near.port, x: near.x, y: near.y });
      } else {
        setWireCursor(raw);
        setSnapWirePort(null);
      }
    }
    // Track cursor for wall preview line
    if (activeTool === 'wall' && wallStart && canvasRef.current) {
      const raw = canvasPointFromClient(event.clientX, event.clientY);
      setWallCursor({ x: snap(raw.x, gridEnabled), y: snap(raw.y, gridEnabled) });
    }
    if ((activeTool === 'door' || activeTool === 'window') && canvasRef.current) {
      const raw = canvasPointFromClient(event.clientX, event.clientY);
      const hit = snapPointToWall(raw, wallSegmentsInLayout(), 32);
      setOpeningSnap(hit ? { x: hit.point.x, y: hit.point.y, angleDeg: hit.angleDeg, kind: activeTool } : null);
    } else if (openingSnap) {
      setOpeningSnap(null);
    }
    if (resizeState && selectedGraphic) {
      const object = selectedGraphic.layout.objects.find((item) => item.id === resizeState.objectId);
      if (!object) return;
      const dw = event.clientX - resizeState.startX;
      const dh = event.clientY - resizeState.startY;
      const nextW = Math.max(MIN_OBJECT_SIZE, snap(resizeState.originW + dw, gridEnabled));
      const nextH = Math.max(MIN_OBJECT_SIZE, snap(resizeState.originH + dh, gridEnabled));
      updateLayoutObjects((objects) => objects.map((item) => item.id === object.id ? { ...item, width: nextW, height: nextH } : item));
      return;
    }
    if (!dragState || !selectedGraphic) return;
    const object = selectedGraphic.layout.objects.find((item) => item.id === dragState.objectId);
    if (!object) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const nextX = clamp(snap(dragState.originX + dx, gridEnabled), 0, selectedGraphic.width - object.width);
    const nextY = clamp(snap(dragState.originY + dy, gridEnabled), 0, selectedGraphic.height - object.height);
    const deltaX = nextX - object.x;
    const deltaY = nextY - object.y;
    const memberIds = dragState.memberIds ?? [];
    updateLayoutObjects((objects) => objects.map((item) => {
      if (item.id === object.id) return { ...item, x: nextX, y: nextY };
      if (memberIds.includes(item.id)) {
        return {
          ...item,
          x: clamp(item.x + deltaX, 0, selectedGraphic.width - item.width),
          y: clamp(item.y + deltaY, 0, selectedGraphic.height - item.height),
        };
      }
      return item;
    }));
  }

  function endDrag() {
    if (dragState) {
      updateLayoutObjects((objects) => {
        let next = updateConnectedWires(objects, dragState.objectId);
        next = updateConnectedCables(next, dragState.objectId);
        return next;
      });
      setNotice({ kind: 'success', text: 'Object moved. Connected wires/cables updated.' });
    }
    if (resizeState) setNotice({ kind: 'success', text: 'Object resized.' });
    setDragState(null);
    setResizeState(null);
    if (panState) setPanState(null);
  }

  function handlePortClick(objectId: string, port: GraphicPort) {
    if (activeTool !== 'wire' && activeTool !== 'cable3d') return;
    if (!selectedGraphic) return;

    if (!wireFrom) {
      if (port.kind === 'in') {
        setNotice({ kind: 'error', text: 'Start from an output port.' });
        return;
      }
      setWireFrom({ objectId, portId: port.id });
      setNotice({ kind: 'success', text: `${activeTool === 'cable3d' ? 'Cable 3D' : 'Wire'}: click destination port.` });
      return;
    }

    if (wireFrom.objectId === objectId && wireFrom.portId === port.id) {
      setWireFrom(null);
      setWireCursor(null);
      setSnapWirePort(null);
      return;
    }

    if (port.kind === 'out') {
      setNotice({ kind: 'error', text: 'Connect to an input port.' });
      return;
    }

    const fromObj = selectedGraphic.layout?.objects?.find((o) => o.id === wireFrom.objectId);
    const toObj = selectedGraphic.layout?.objects?.find((o) => o.id === objectId);
    if (!fromObj || !toObj) {
      setWireFrom(null);
      return;
    }

    try {
      if (activeTool === 'cable3d') {
        const cable = createCable3dFromPorts(fromObj, wireFrom.portId, toObj, port.id, makeId('cable3d'), `Cable ${fromObj.name}→${toObj.name}`);
        const hostId = findViewportHost(selectedGraphic.layout?.objects ?? [], cable);
        if (hostId) cable.style = { ...cable.style, viewportHostId: hostId };
        updateLayoutObjects((items) => [...items, cable as GraphicObjectDefinition]);
        setSelectedObjectId(cable.id);
      } else {
        const wire = createWireObject(fromObj, wireFrom.portId, toObj, port.id, makeId('wire'), `Wire ${fromObj.name}→${toObj.name}`);
        updateLayoutObjects((items) => [...items, wire as GraphicObjectDefinition]);
        setSelectedObjectId(wire.id);
      }
      setWireFrom(null);
      setWireCursor(null);
      setSnapWirePort(null);
      setActiveTool('select');
      setNotice({ kind: 'success', text: activeTool === 'cable3d' ? '3D cable connected between ports.' : 'Wire connected between ports.' });
    } catch {
      setNotice({ kind: 'error', text: 'Could not create connection — check ports.' });
      setWireFrom(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && (catalogPlacePayload || armedRoomPrefabId || armedCatalogLabel)) {
      disarmCatalog();
      return;
    }
    if (wireFrom && event.key === 'Escape') {
      setWireFrom(null);
      setWireCursor(null);
      setSnapWirePort(null);
      setNotice({ kind: 'success', text: 'Wire placement cancelled.' });
      return;
    }
    if (activeTool === 'wire' && event.key === 'Escape') {
      setActiveTool('select');
      setWireFrom(null);
      setWireCursor(null);
      setSnapWirePort(null);
      setNotice({ kind: 'success', text: 'Wire tool deactivated.' });
      return;
    }
    if (activeTool === 'cable3d' && event.key === 'Escape') {
      setActiveTool('select');
      setWireFrom(null);
      setWireCursor(null);
      setSnapWirePort(null);
      setNotice({ kind: 'success', text: 'Cable 3D tool deactivated.' });
      return;
    }
    if (pathEditId && event.key === 'Enter') {
      setPathEditId(null);
      setActiveTool('select');
      setNotice({ kind: 'success', text: 'Path editing finished.' });
      return;
    }
    if (pathEditId && event.key === 'Escape') {
      setPathEditId(null);
      setNotice({ kind: 'success', text: 'Path editing cancelled.' });
      return;
    }
    if (activeTool === 'room' && event.key === 'Escape') {
      if (roomPoints.length) {
        setRoomPoints([]);
        setNotice({ kind: 'success', text: 'Room drawing cancelled.' });
      } else {
        setActiveTool('select');
        setNotice({ kind: 'success', text: 'Room tool deactivated.' });
      }
      return;
    }
    if (activeTool === 'room' && event.key === 'Enter' && roomPoints.length >= MIN_ROOM_CORNERS) {
      finalizeRoomFromPolygonPoints(roomPoints);
      return;
    }
    if (activeTool === 'measure' && event.key === 'Escape') {
      setMeasurePoints([]);
      setActiveTool('select');
      return;
    }
    // Wall tool: Escape cancels active wall drawing
    if (activeTool === 'wall' && event.key === 'Escape') {
      if (wallStart) {
        setWallStart(null);
        setWallCursor(null);
        setNotice({ kind: 'success', text: 'Wall drawing cancelled.' });
      } else {
        setActiveTool('select');
        setNotice({ kind: 'success', text: 'Wall tool deactivated.' });
      }
      return;
    }
    if (!selectedObject) return;
    if (event.key === 'Delete') {
      deleteObject();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateObject();
      return;
    }
    const step = event.shiftKey ? GRID_SIZE : 1;
    if (event.key === 'ArrowLeft') updateObject({ x: selectedObject.x - step });
    if (event.key === 'ArrowRight') updateObject({ x: selectedObject.x + step });
    if (event.key === 'ArrowUp') updateObject({ y: selectedObject.y - step });
    if (event.key === 'ArrowDown') updateObject({ y: selectedObject.y + step });
  }

  function runObjectToolCommand(item: string) {
    const toolMap: Record<string, GraphicObjectType> = {
      text: 'text', image: 'image', value: 'value', gauge: 'gauge', trend: 'trend', alarm: 'alarm', line: 'line', rectangle: 'rectangle', button: 'button',
      circle: 'circle', polygon: 'polygon', switch: 'switch', slider: 'slider', led: 'led', levelbar: 'levelbar', multistate: 'multistate', navbutton: 'navbutton',
      tagtable: 'tagtable', alarmtable: 'alarmtable', sparkline: 'sparkline', barchart: 'barchart', piechart: 'piechart', kpicard: 'kpicard',
      formulavalue: 'formulavalue', statusbadge: 'statusbadge',
      panel: 'panel', hotspot: 'hotspot', tabbar: 'tabbar', group: 'group',
      flowpath: 'flowpath', 'flow path': 'flowpath', elecsymbol: 'elecsymbol', 'elec symbol': 'elecsymbol'
    };
    const type = toolMap[item];
    if (type) {
      setActiveTool(type);
      setNotice({ kind: 'success', text: `Tool ${type} selected. Click on the Canvas to place the Object.` });
    }
  }

  useEffect(() => {
    function onCommand(event: Event) {
      const detail = (event as CustomEvent<EditorCommand>).detail;
      if (detail.module !== 'graphics') return;
      const item = normalizeCommand(detail.item);
      if (item === 'designer' || item === 'graphics list' || item === 'properties') void load();
      else if (item === 'new graphic') setIsNewGraphicModalOpen(true);
      else if (item === 'save') void saveGraphic();
      else if (item === 'set default') void setDefaultGraphic();
      else if (item === 'delete') selectedObject ? deleteObject() : void deleteGraphic();
      else if (item === 'validate') validateCurrentGraphic();
      else if (item === 'preview') setLiveModalOpen(true);
      else if (item === 'publish') publishGraphicPackage();
      else if (item === 'align') alignSelected('center');
      else if (item === 'lock') selectedObject ? updateObject({ locked: !selectedObject.locked }) : setNotice({ kind: 'error', text: 'Select an object before Lock.' });
      else if (item === 'zoom') cycleCanvasZoom();
      else if (item === 'zoom fit') fitCanvasZoom();
      else if (item === 'detect room') detectRoomFromWalls();
      else if (item === 'measure') { setActiveTool('measure'); setMeasurePoints([]); setNotice({ kind: 'success', text: toolHintFor('measure') }); }
      else if (item === 'object tools') setActiveTool('text');
      else if (item === 'bind tag') bindFirstAvailableTag();
      else if (item === 'grid 20px') { setGridEnabled((value) => !value); setNotice({ kind: 'success', text: `Grid 20px ${gridEnabled ? 'disabled' : 'enabled'}` }); }
      else if (item === 'snap 3d') { setSnap3dEnabled((value) => !value); setNotice({ kind: 'success', text: `3D snap ${snap3dEnabled ? 'disabled' : 'enabled'}` }); }
      else if (item === 'room tool') { setActiveTool('room'); setRoomPoints([]); setNotice({ kind: 'success', text: toolHintFor('room') }); }
      else if (item === 'wall tool') { setActiveTool('wall'); setWallStart(null); setNotice({ kind: 'success', text: toolHintFor('wall') }); }
      else runObjectToolCommand(item);
    }
    window.addEventListener(EDITOR_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(EDITOR_COMMAND_EVENT, onCommand);
  }, [selectedGraphic, selectedObject, tags, graphics, newGraphic, gridEnabled]);

  return (
    <div
      className={`graphics-page graphics-page-v2${leftPanelCollapsed ? ' gfx-left-collapsed' : ''}${rightPanelCollapsed ? ' gfx-right-collapsed' : ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (selectedGraphic && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const scale = is3dCamera ? 0.85 : 1;
            const cx = rect.width / 2 / scale;
            const cy = rect.height / 2 / scale;
            void importImageFile(file, cx, cy);
          } else {
            void importImageFile(file);
          }
        }}
      />
      <input
        ref={glbFileInputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (selectedGraphic && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const scale = is3dCamera ? 0.85 : 1;
            void importGlbFile(file, rect.width / 2 / scale, rect.height / 2 / scale);
          } else {
            void importGlbFile(file);
          }
        }}
      />
      {notice ? <div className={`gfx-toast ${notice.kind}`} role="status">{notice.text}</div> : null}

      {!activeProject ? (
        <div className="dv-no-project-overlay">
          <div className="dv-no-project-card">
            <div className="dv-no-project-icon">
              <Icon icon="solar:folder-error-bold-duotone" width="48" height="48" />
            </div>
            <h2>No Active Project Selected</h2>
            <p>Please select or create an active project in the Project Manager before designing graphics.</p>
            <button className="btn primary" onClick={() => window.dispatchEvent(new CustomEvent('energylink:switch-module', { detail: 'file' }))}>
              <Icon icon="solar:document-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#fff', verticalAlign: 'middle' }} />
              Go to Project Manager
            </button>
          </div>
        </div>
      ) : (
      <div className="graphics-layout-wrap">
      <div className="graphics-layout">
        {isBusy ? (
          <div className="graphics-busy-overlay" role="status" aria-live="polite">
            <div className="graphics-busy-card">
              <Icon icon="solar:refresh-bold-duotone" width="28" height="28" className="graphics-busy-spin" />
              <span>กำลังประมวลผล… รอสักครู่</span>
            </div>
          </div>
        ) : null}
        <aside className="graphics-toolbox card">
          <div className="gfx-left-section">
            <div className="gfx-left-section-head">
            <span className="section-title-icon-text">
                <Icon icon="solar:folder-bold-duotone" width="16" height="16" style={{ color: '#fb7185' }} />
                <b>Graphics</b>
            </span>
              <button type="button" className="gfx-panel-toggle" onClick={() => setLeftPanelCollapsed((v) => !v)} title={leftPanelCollapsed ? 'Expand panel' : 'Collapse panel'}>
                <Icon icon={leftPanelCollapsed ? 'solar:alt-arrow-right-bold' : 'solar:alt-arrow-left-bold'} width="14" height="14" />
              </button>
          </div>
            <div className="gfx-left-section-body gfx-scroll-list">
          <div style={{ padding: '0 10px 8px' }}>
            <button className="btn primary" onClick={() => setIsNewGraphicModalOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}>
              <Icon icon="solar:document-add-bold-duotone" width="16" height="16" style={{ color: '#34d399' }} />
              New Graphic
            </button>
          </div>
          <div className="graphic-list-compact">
            {graphics.map((graphic) => (
              <button
                key={graphic.id}
                className={graphic.id === selectedGraphicId ? 'graphic-list-item-compact selected' : 'graphic-list-item-compact'}
                onClick={() => { setSelectedGraphicId(graphic.id); setSelectedObjectId(''); }}
              >
                <div className="graphic-item-main">
                  <span className="graphic-item-name">{graphic.name}</span>
                  {graphic.isDefault && <span className="default-badge">Default</span>}
                </div>
                <span className="graphic-item-meta">{graphic.width} × {graphic.height} · {graphic.layout?.objects?.length || 0} objects</span>
              </button>
            ))}
            {graphics.length === 0 && <p className="muted" style={{ padding: '0 8px', fontSize: '12px' }}>No graphics in project.</p>}
              </div>
            </div>
          </div>

          <div className="gfx-left-section">
            <div className="gfx-left-section-head">
            <span className="section-title-icon-text">
                <Icon icon="solar:widget-5-bold-duotone" width="16" height="16" style={{ color: '#38bdf8' }} />
                <b>Tools</b>
            </span>
          </div>
            <div className="gfx-left-section-body gfx-scroll-tools">
          <div className="palette-icon-tabs">
            {(Object.keys(toolCategories) as PaletteCategory[]).map((key) => (
              <button
                key={key}
                type="button"
                className={paletteTab === key ? 'palette-icon-tab active' : 'palette-icon-tab'}
                onClick={() => setPaletteTab(key)}
                title={toolCategories[key].label}
              >
                <Icon
                  icon={toolCategories[key].icon}
                  width="18" height="18"
                  style={{ color: paletteTab === key ? '#fff' : toolCategories[key].color }}
                />
              </button>
            ))}
          </div>
          <div className="palette-tab-label">{toolCategories[paletteTab].label}</div>

          {/* Wire/Cable special tools when SLD tab active */}
          {selectedGraphic && paletteTab === 'sld' && (
            <div className="wire-tools-row">
              <button
                type="button"
                className={activeTool === 'wire' ? 'object-tool selected compact' : 'object-tool compact'}
                onClick={() => { setActiveTool('wire'); setWireFrom(null); setWireCursor(null); }}
                title="Wire Tool — ต่อ port ระหว่างอุปกรณ์"
              >
                <Icon icon="solar:link-round-bold-duotone" width="18" height="18" style={{ color: '#22d3ee' }} />
                Wire
              </button>
              <button
                type="button"
                className={activeTool === 'cable3d' ? 'object-tool selected compact' : 'object-tool compact'}
                onClick={() => { setActiveTool('cable3d'); setWireFrom(null); setWireCursor(null); }}
                title="Cable 3D"
              >
                <Icon icon="solar:link-circle-bold-duotone" width="18" height="18" style={{ color: '#a78bfa' }} />
                Cable
              </button>
            </div>
          )}
          
          {selectedGraphic && paletteTab === 'scene' ? (
            <div className="gfx-scene-hint">
              <Icon icon="solar:code-square-bold-duotone" width="28" height="28" style={{ color: '#6366f1' }} />
              <p><b>สร้างด้วย Script</b> — แท็บ Properties → Script</p>
              <small>กำหนด room + equipment ใน JSON · หรือใช้ Scene Catalog ด้านล่าง</small>
              <button
                type="button"
                className="btn secondary tiny gfx-open-script-btn"
                onClick={() => setPropTab('script')}
              >
                เปิด Script
              </button>
            </div>
          ) : null}

          {paletteTab !== 'scene' ? (
            <div className="object-tool-grid">
              <button className={activeTool === 'select' ? 'object-tool selected' : 'object-tool'} onClick={() => setActiveTool('select')} disabled={!selectedGraphic}><span><Icon icon="solar:cursor-bold-duotone" width="20" height="20" style={{ color: activeTool === 'select' ? '#38bdf8' : '#0ea5e9' }} /></span>Select</button>
              <button className={activeTool === 'pan' ? 'object-tool selected' : 'object-tool'} onClick={() => setActiveTool('pan')} disabled={!selectedGraphic}><span><Icon icon="solar:hand-shake-bold-duotone" width="20" height="20" style={{ color: activeTool === 'pan' ? '#38bdf8' : '#64748b' }} /></span>Pan</button>
              {objectTools.filter((tool) => toolCategories[paletteTab].types.includes(tool.type)).map((tool) => (
                <button key={tool.type} className={activeTool === tool.type ? 'object-tool selected' : 'object-tool'} onClick={() => setActiveTool(tool.type)} disabled={!selectedGraphic}>
                  <span>{tool.icon}</span>{tool.label}
                </button>
              ))}
            </div>
          ) : null}
            </div>
          </div>
        </aside>

        <main className="graphics-designer-card card">
          <GraphicEditorToolbar
            selectedGraphic={selectedGraphic}
            isBusy={isBusy}
            editorViewMode={editorViewMode}
            onEditorViewModeChange={setEditorViewMode}
            viewportDebug={viewportDebug}
            onViewportDebugChange={(patch) => setViewportDebug((d) => ({ ...d, ...patch }))}
            cameraPreset={cameraPreset}
            gridEnabled={gridEnabled}
            snap3dEnabled={snap3dEnabled}
            canvasZoom={canvasZoom}
            liveModalOpen={liveModalOpen}
            onSave={saveGraphic}
            onValidate={validateCurrentGraphic}
            onSetDefault={setDefaultGraphic}
            onExport={exportGraphic}
            onImportFile={(file) => void importGraphicFile(file)}
            onCameraChange={changeDefaultCamera}
            onToggleGrid={() => setGridEnabled((v) => !v)}
            onToggleSnap3d={() => setSnap3dEnabled((v) => !v)}
            onZoomOut={() => setCanvasZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
            onZoomIn={() => setCanvasZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
            onFitZoom={fitCanvasZoom}
            onLivePreview={() => setLiveModalOpen(true)}
            onRefresh={load}
            onDelete={selectedObject ? deleteObject : deleteGraphic}
          />
          <GraphicEditorCanvas
            selectedGraphic={selectedGraphic}
            floorLevels={floorLevels}
            activeFloor={activeFloor}
            onFloorChange={setActiveFloor}
            activeTool={activeTool}
            is3dCamera={is3dCamera}
            cameraPreset={cameraPreset}
            canvasZoom={canvasZoom}
            viewportObjects={viewportObjects}
            canvasObjects={canvasObjects}
            canvasPointerActive={canvasPointerActive}
            gridEnabled={gridEnabled}
            selectedObjectId={selectedObjectId}
            pathEditId={pathEditId}
            editorCurrentValues={editorCurrentValues}
            r3fTagValues={r3fTagValues}
            wireFrom={wireFrom}
            wireCursor={wireCursor}
            wallStart={wallStart}
            wallCursor={wallCursor}
            roomPoints={roomPoints}
            measurePoints={measurePoints}
            openingSnap={openingSnap}
            editorViewMode={editorViewMode}
            floatingHudEnabled={viewportDebug.widgets}
            onEditorViewModeChange={setEditorViewMode}
            activeToolLabel={activeToolLabel}
            toolHint={is3dCamera ? toolHintFor3d(activeTool) : toolHintFor(activeTool)}
            flowPreviewEnabled={viewportDebug.flow}
            catalogArmedLabel={armedCatalogLabel}
            onDisarmCatalog={disarmCatalog}
            floorClickEnabled={floorClickEnabled}
            canvasRef={canvasRef}
            canvasScrollRef={canvasScrollRef}
            onPanMouseDown={(e) => {
              if (activeTool === 'pan' && canvasScrollRef.current) {
                setPanState({
                  startX: e.clientX,
                  startY: e.clientY,
                  scrollLeft: canvasScrollRef.current.scrollLeft,
                  scrollTop: canvasScrollRef.current.scrollTop,
                });
              }
            }}
            onCanvasClick={onCanvasClick}
            onCanvasDrop={onCanvasDrop}
            onMouseMove={moveDrag}
            onMouseUp={endDrag}
                  onSelectObject={setSelectedObjectId}
                  onUpdateObject={(id, patch) => {
              updateLayoutObjects((objects) => objects.map((o) => (o.id === id ? { ...o, ...patch } : o)));
            }}
            onZonePaint={(x, y) => {
              if (!selectedGraphic) return;
              addObject('zone3d', x - 60, y - 40);
              setNotice({ kind: 'success', text: 'Room zone placed on 3D floor — adjust size in properties.' });
            }}
            onFloorClick={(x, y) => {
              const point = resolveCanvasPoint(x, y);
              handleCanvasPointAt(point.x, point.y);
            }}
            onDragStart={startDrag}
            onResizeStart={startResize}
            onPathChange={updatePathPoints}
                  onPortClick={handlePortClick}
                />
        </main>

          {selectedGraphic ? (
          <GraphicPropertiesSidebar
            collapsed={rightPanelCollapsed}
            onToggleCollapsed={() => setRightPanelCollapsed((v) => !v)}
            propTab={propTab}
            onPropTabChange={setPropTab}
            selectedGraphic={selectedGraphic}
            selectedObject={selectedObject}
                  selectedObjectId={selectedObjectId}
            images={images}
            gridEnabled={gridEnabled}
            cameraPreset={cameraPreset}
            isBusy={isBusy}
            snapshots={snapshots}
            onLivePreview={() => setLiveModalOpen(true)}
            onGridChange={setGridEnabled}
            onCameraChange={changeDefaultCamera}
            onUpdateGraphic={updateSelectedGraphicLocal}
            syncScene3dObjects={syncScene3dObjects}
            onSelectObject={setSelectedObjectId}
                  onToggleVisible={toggleVisibleById}
                  onMoveLayer={moveLayerById}
            onRestoreSnapshot={restoreSnapshot}
            onDeleteSnapshot={removeSnapshot}
            onRunSceneScript={(json, mode) => void runSceneScript(json, mode)}
                  onDownloadBlender={downloadBlenderMccScript}
            elementPanel={
              <GraphicElementPropertiesPanel
                    object={selectedObject}
                selectedExtra={selectedExtra}
                elementPropMode={elementPropMode}
                onElementPropModeChange={setElementPropMode}
                selectedGraphic={selectedGraphic}
                graphics={graphics}
                tags={tags}
                filteredBindingTags={filteredBindingTags}
                devices={devices}
                    images={images}
                    model3dAssets={model3dAssets}
                    splineAssets={splineAssets}
                assets={assets}
                bindingDeviceId={bindingDeviceId}
                onBindingDeviceChange={setBindingDeviceId}
                copiedFlowStyle={copiedFlowStyle}
                sceneScaleMmPerPx={selectedGraphic.layout?.sceneScaleMmPerPx ?? DEFAULT_MM_PER_PX}
                onUpdate={updateObject}
                    onBindTag={bindSelectedTag}
                    onBindFlowTag={bindFlowTag}
                onBindEnableTag={bindEnableTag}
                    onPickImage={pickImage}
                    onImportImage={() => imageFileInputRef.current?.click()}
                    onImportGlb={() => glbFileInputRef.current?.click()}
                    onConvertTo3dBox={convertSelectedImageTo3dBox}
                    onConvertToGlb={(mode) => void convertSelectedImageToGlb(mode)}
                onStartPathEdit={(id, text) => { setPathEditId(id); setNotice({ kind: 'success', text }); }}
                    onSyncCable={syncSelectedCableFromWire}
                onShowNotice={setNotice}
                onCopyFlowStyle={(style) => { setCopiedFlowStyle(style); setNotice({ kind: 'success', text: 'Flow path style copied.' }); }}
                onSetDisplayMode={setDisplayMode}
                onApplyGlbPorts={() => void applyGlbPortsFromModel()}
                onWrapSelectionInGroup={wrapSelectionInGroup}
                onUngroupSelected={ungroupSelected}
                onMakeComposite={makeCompositeFromSelection}
                onDuplicateObject={duplicateObject}
                onBringForward={bringForward}
                onSendBackward={sendBackward}
                onDeleteObject={deleteObject}
                onAlignSelected={alignSelected}
              />
            }
          />
                    ) : null}
                  </div>
      {selectedGraphic ? (
        <GraphicSceneCatalogStrip
          category={catalogStripCategory}
          onCategoryChange={handleCatalogCategoryChange}
          armedPayloadId={catalogPlacePayload ? armedCatalogId : null}
          armedToolId={catalogPlacePayload ? null : armedCatalogId}
          images={images}
          disabled={!selectedGraphic}
          onArmPayload={armCatalogPayload}
          onArmTool={armCatalogTool}
          onDisarm={disarmCatalog}
          onAction={(action) => {
            if (action === 'autoRoute') autoRouteEquipment();
            else setLiveModalOpen(true);
          }}
        />
                        ) : null}
                      </div>
                    )}

      {liveModalOpen && selectedGraphic ? (
        <div className="gfx-live-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setLiveModalOpen(false)}>
          <div className="gfx-live-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gfx-live-modal-head">
              <b>Live Preview — {selectedGraphic.name}</b>
              <button type="button" className="btn secondary" onClick={() => setLiveModalOpen(false)}>ปิด</button>
                      </div>
            <GraphicsLivePreview graphic={selectedGraphic} graphics={graphics} />
                      </div>
                      </div>
                    ) : null}

      {/* Create New Graphic Modal */}
      {isNewGraphicModalOpen && (
        <div className="custom-modal-backdrop" onClick={() => setIsNewGraphicModalOpen(false)}>
          <div className="custom-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header alert">
              <div className="custom-modal-icon alert">
                <Icon icon="solar:document-add-bold-duotone" width="22" height="22" />
              </div>
              <h3>Create New Graphic</h3>
            </div>
            <div className="custom-modal-body">
              <div className="new-graphic-modal-form">
                <label>
                  Graphic Name
                  <input
                    value={newGraphic.name}
                    onChange={(event) => setNewGraphic({ ...newGraphic, name: event.target.value })}
                    placeholder="e.g. Main Dashboard"
                    autoFocus
                  />
                </label>
                <div className="two-col">
                  <label>
                    Width (px)
                    <input
                      type="number"
                      min={320}
                      value={newGraphic.width}
                      onChange={(event) => setNewGraphic({ ...newGraphic, width: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    Height (px)
                    <input
                      type="number"
                      min={240}
                      value={newGraphic.height}
                      onChange={(event) => setNewGraphic({ ...newGraphic, height: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Refresh Rate (ms)
                  <input
                    type="number"
                    min={250}
                    value={newGraphic.refreshIntervalMs}
                    onChange={(event) => setNewGraphic({ ...newGraphic, refreshIntervalMs: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Template
                  <select
                    value={newGraphic.templateId}
                    onChange={(event) => {
                      const tpl = getGraphicTemplate(event.target.value);
                      setNewGraphic({
                        ...newGraphic,
                        templateId: event.target.value,
                        width: tpl.width,
                        height: tpl.height,
                      });
                    }}
                  >
                    {GRAPHIC_TEMPLATES.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>{tpl.label} — {tpl.description}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="custom-modal-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setIsNewGraphicModalOpen(false);
                  setNewGraphic({ name: '', width: 1366, height: 768, refreshIntervalMs: 1000, templateId: 'blank' });
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={async () => {
                  await createGraphic();
                  setIsNewGraphicModalOpen(false);
                  setNewGraphic({ name: '', width: 1366, height: 768, refreshIntervalMs: 1000, templateId: 'blank' });
                }}
                disabled={isBusy}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}