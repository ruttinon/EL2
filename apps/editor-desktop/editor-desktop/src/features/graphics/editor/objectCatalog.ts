import type { GraphicObjectDefinition, GraphicObjectType } from '@energylink/shared-types';
import { applySceneDefaultsToStyle, defaultPolygonPoints, formatMemberIds } from '@energylink/graphics-runtime';
import { getWidgetDefinition, listRegistryWidgets, registryToolKey } from '@energylink/widget-registry';
import { FREE_IMAGE_STYLE } from '../imageHelpers';
import { allSymbols, symbolById } from '../graphicSymbols';
import { widgetDefToToolDef } from '../widget-registry/bridge';
import type { LucideIcon } from 'lucide-react';
import {
  Type, Square, Circle, Minus, Image as ImageIcon, Hash, Gauge, Percent, Lightbulb,
  Layers, Droplet, LayoutDashboard, BadgeCheck, Clock, FunctionSquare, TrendingUp, BarChart3,
  Table2, AlertTriangle, Plug, TrafficCone,
} from 'lucide-react';

export type ToolDef = {
  /** Unique tool id. Defaults to `type`. Use it when several tools share one base type (e.g. door/window). */
  key?: string;
  type: GraphicObjectType;
  label: string;
  icon: LucideIcon;
  color: string;
  width: number;
  height: number;
  text?: string;
  /** Extra style merged into the created object. */
  style?: Record<string, unknown>;
  /** Base name override (defaults to label). */
  name?: string;
  /** Short help shown on hover in the widget library. */
  hint?: string;
};

export function toolKey(t: ToolDef): string {
  return t.key ?? t.type;
}

export type ToolGroup = 'display' | 'action';

export type ToolCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** PowerStudio-style split: display widgets vs interactive/action widgets. */
  group: ToolGroup;
  tools: ToolDef[];
};

/** Quick tools shown directly on the floating rail (Figma-style). */
export const RAIL_TOOLS: ToolDef[] = [
      { type: 'text', label: 'Text', icon: Type, color: '#3b82f6', width: 180, height: 44, text: 'Text', style: { background: 'transparent', fill: 'transparent' } },
  { type: 'rectangle', label: 'Rectangle', icon: Square, color: '#3b82f6', width: 180, height: 110, text: '' },
  { type: 'circle', label: 'Ellipse', icon: Circle, color: '#0ea5e9', width: 120, height: 120 },
  { type: 'line', label: 'Line', icon: Minus, color: '#6b7280', width: 220, height: 12, style: { stroke: '#475569', strokeWidth: 2, lineDash: 'solid', lineCap: 'round', background: '#475569' } },
  { type: 'image', label: 'Image', icon: ImageIcon, color: '#10b981', width: 200, height: 130, style: { ...FREE_IMAGE_STYLE } },
  { type: 'value', label: 'Value', icon: Hash, color: '#0ea5e9', width: 190, height: 72, text: 'Power', style: { transparentBg: true, fill: 'transparent', background: 'transparent', strokeWidth: 0, stroke: 'transparent', color: '#e2e8f0', unit: 'kW', decimalPlaces: 2, valueVariant: 'minimal' } },
];

/** Full library grouped into the widget flyout — legacy only (registry widgets use WidgetPalette). */
export const CATEGORIES: ToolCategory[] = [];

const REGISTRY_TOOLS: ToolDef[] = listRegistryWidgets().map(widgetDefToToolDef);

const ALL_TOOLS: ToolDef[] = [
  ...REGISTRY_TOOLS,
  ...CATEGORIES.flatMap((c) => c.tools),
];

/** Categories for legacy palette (excludes registry-backed widgets). */
export function legacyPaletteCategories(): ToolCategory[] {
  const registryKeys = new Set(REGISTRY_TOOLS.map((t) => toolKey(t)));
  const registryTypes = new Set(REGISTRY_TOOLS.map((t) => t.type));
  return CATEGORIES.map((cat) => ({
    ...cat,
    tools: cat.tools.filter((t) => !registryKeys.has(toolKey(t)) && !registryTypes.has(t.type)),
  })).filter((cat) => cat.tools.length > 0);
}

/** Ribbon / scene-catalog aliases → catalog tool keys */
const TOOL_ALIASES: Record<string, string> = {
  wire: 'flowpath',
};

export function resolveToolKey(key: string): string {
  if (key.startsWith('symbol:')) return key;
  return TOOL_ALIASES[key] ?? key;
}

export function findTool(key: string): ToolDef | undefined {
  const resolved = resolveToolKey(key);
  const reg = getWidgetDefinition(resolved);
  if (reg) return widgetDefToToolDef(reg);
  if (resolved.startsWith('symbol:')) {
    return ALL_TOOLS.find((t) => t.type === 'elecsymbol');
  }
  return ALL_TOOLS.find((t) => toolKey(t) === resolved);
}

export function toolByKey(key: string): ToolDef {
  return findTool(key) ?? ALL_TOOLS[0];
}

export function toolLabel(key: string): string {
  return findTool(key)?.label ?? key;
}

export function toolHint(key: string): string | undefined {
  return findTool(key)?.hint;
}

/** Human-readable type name for Inspector (Thai + English). */
export const INSPECTOR_TYPE_LABELS: Record<string, string> = {
  text: 'ข้อความ',
  rectangle: 'สี่เหลี่ยม',
  circle: 'วงกลม',
  ellipse: 'วงรี',
  polygon: 'รูปหลายเหลี่ยม',
  line: 'เส้น',
  image: 'รูปภาพ',
  video: 'วิดีโอ',
  flowpath: 'เส้นไหล',
  bussection: 'Bus',
  feedlabel: 'ป้าย Feeder',
  zone2d: 'โซน 2D',
  hotspot: 'จุดคลิก',
  slider: 'สไลด์',
  inputfield: 'ช่องกรอก',
  dropdown: 'ดรอปดาวน์',
  navbutton: 'ปุ่มเปลี่ยนหน้า',
  tabbar: 'แถบแท็บ',
  panel: 'กล่องหัวข้อ',
  group: 'กลุ่ม',
  value: 'ค่า (Value)',
  gauge: 'เกจ',
  status: 'สถานะ',
  led: 'สถานะ (legacy)',
  button: 'ปุ่ม',
  switch: 'สวิตช์',
  progressbar: 'แถบความคืบหน้า',
  levelbar: 'แถบระดับ',
  kpicard: 'KPI Card',
  statusbadge: 'สถานะ (legacy)',
  multistate: 'หลายสถานะ',
  semaphore: 'ไฟจราจร',
  clock: 'นาฬิกา',
  formulavalue: 'สูตรคำนวณ',
};

/** Value-category widgets (Values tab). */
export const VALUE_TOOL_TYPES = new Set([
  'value', 'gauge', 'progressbar', 'led', 'semaphore', 'multistate',
  'levelbar', 'kpicard', 'statusbadge', 'clock', 'formulavalue',
]);

/** Essential tools shown first in the widget library. */
export const BASIC_TOOL_TYPES = new Set([
  'text', 'rectangle', 'line', 'image', 'value', 'gauge', 'led', 'button', 'switch',
]);

export function inspectorTypeLabel(type: string): string {
  return INSPECTOR_TYPE_LABELS[type] ?? type;
}

export function toolFor(type: GraphicObjectType): ToolDef {
  return ALL_TOOLS.find((t) => t.type === type) ?? ALL_TOOLS[0];
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

/** Per-type extra style for building / 3D / layout objects, derived from final placement bounds. */
function placementStyle(type: GraphicObjectType, x: number, y: number, w: number, h: number): Record<string, unknown> {
  if (type === 'polygon') {
    const sides = 3;
    return {
      polygonSides: sides,
      polygonPoints: defaultPolygonPoints(x, y, w, h, sides),
    };
  }
  if (type === 'line') {
    const sw = 2;
    return { strokeWidth: sw, background: '#475569', stroke: '#475569', lineDash: 'solid', lineCap: 'round' };
  }
  if (type === 'value' || type === 'gauge' || type === 'kpicard' || type === 'formulavalue') {
    return { unit: type === 'gauge' ? '%' : type === 'value' ? 'kW' : '', decimalPlaces: 2, min: 0, max: 100 };
  }
  if (type === 'progressbar') {
    return { fill: '#22c55e', trackColor: '#e2e8f0', min: 0, max: 100, unit: '%', decimalPlaces: 0 };
  }
  if (type === 'levelbar') {
    return { fill: '#0891b2', trackColor: '#e2e8f0', min: 0, max: 100, unit: '%', decimalPlaces: 1 };
  }
  if (type === 'multistate') {
    return { states: 'Stopped,Running,Fault' };
  }
  if (type === 'status') {
    return { statusVariant: 'lamp', onColor: '#22c55e', offColor: '#94a3b8', fill: '#1e293b' };
  }
  if (type === 'statusbadge') {
    return { badgeMap: '0:Stop:#94a3b8,1:Run:#22c55e,2:Fault:#ef4444' };
  }
  if (type === 'semaphore') {
    return { semColorGreen: '#22c55e', semColorYellow: '#f59e0b', semColorRed: '#ef4444', fill: '#1e293b' };
  }
  if (type === 'led') {
    return { onColor: '#22c55e', offColor: '#94a3b8' };
  }
  if (type === 'clock') {
    return { clockVariant: 'digital', clockFormat: 'local', clockTimeStyle: '24h', showSeconds: true, showDate: true };
  }
  return {};
}

/** Place a symbol from the library as an elecsymbol with embedded SVG. */
export function makeSymbolObject(
  symbolId: string,
  x: number,
  y: number,
  zTop: number,
): GraphicObjectDefinition {
  const sym = symbolById(allSymbols(), symbolId);
  const obj = makeObject('elecsymbol', x, y, zTop);
  if (sym) {
    obj.name = sym.name;
    obj.style = {
      ...obj.style,
      customSymbolId: sym.id,
      customSymbolSvg: sym.svgContent,
      symbolId: undefined,
    };
  }
  return obj;
}

/** Create a new object definition for the given tool key, centered (or placed) on the canvas. */
export function makeObject(
  key: string,
  x: number,
  y: number,
  zTop: number,
): GraphicObjectDefinition {
  if (key.startsWith('symbol:')) {
    return makeSymbolObject(key.slice(7), x, y, zTop);
  }
  const resolved = resolveToolKey(key);
  const tool = findTool(key);
  if (!tool) {
    throw new Error(`Unknown tool: ${key}`);
  }
  const type = tool.type;
  const id = makeId(type);
  const ox = Math.round(x - tool.width / 2);
  const oy = Math.round(y - tool.height / 2);
  return {
    id,
    type,
    name: `${tool.name ?? tool.label}_${id.slice(-5)}`,
    x: ox,
    y: oy,
    width: tool.width,
    height: tool.height,
    text: tool.text,
    visible: true,
    locked: false,
    layer: zTop + 1,
    style: applySceneDefaultsToStyle(type, {
      fill: '#ffffff',
      stroke: '#9fc4cc',
      strokeWidth: 1,
      color: '#142033',
      fontSize: 16,
      background: '#ffffff',
      align: 'center',
      ...placementStyle(type, ox, oy, tool.width, tool.height),
      ...(tool.style ?? {}),
    }),
  };
}

/** Logical group container (not placed from palette — use Ctrl+G on multi-selection). */
export function makeGroupObject(
  x: number,
  y: number,
  width: number,
  height: number,
  memberIds: string[],
  zTop: number,
  name?: string,
): GraphicObjectDefinition {
  const id = makeId('group');
  return {
    id,
    type: 'group',
    name: name ?? `Group_${id.slice(-5)}`,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    visible: true,
    locked: false,
    layer: zTop + 1,
    style: {
      memberIds: formatMemberIds(memberIds),
      fill: 'transparent',
      background: 'transparent',
      strokeWidth: 0,
    },
  };
}

/** Full-page scene3d GLB used as a building digital-twin background. */
export function makeGlbBuildingObject(
  width: number,
  height: number,
  glbUrl: string,
  name = 'Building',
): GraphicObjectDefinition {
  const id = makeId('scene3d');
  return {
    id,
    type: 'scene3d',
    name,
    x: 0,
    y: 0,
    width,
    height,
    visible: true,
    locked: true,
    layer: 0,
    style: applySceneDefaultsToStyle('scene3d', {
      glbUrl,
      sceneBuildMode: 'glb',
      autoRotate: false,
      cameraPreset: 'orbit',
      unifiedLayer: 'world',
    }),
  };
}
