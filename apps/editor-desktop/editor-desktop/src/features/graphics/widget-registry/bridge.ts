import type { LucideIcon } from 'lucide-react';
import {
  Hash, Gauge, MousePointerClick, Lightbulb, Plug, Type, Square, Circle, Minus,
  Image as ImageIcon, Percent, Layers, Droplet, LayoutDashboard, BadgeCheck, Clock,
  FunctionSquare, TrendingUp, BarChart3, Table2, AlertTriangle, ToggleLeft,
  SlidersHorizontal, TextCursorInput, ChevronDown, ArrowRight, Zap, Cable, Tag,
  Crosshair, LayoutPanelTop, Triangle, FolderOpen, Map, PlayCircle, TrafficCone,
} from 'lucide-react';
import type { WidgetDefinition } from '@energylink/widget-registry';
import { registryToolKey } from '@energylink/widget-registry';
import type { ToolDef } from '../editor/objectCatalog';

const ICON_MAP: Record<string, LucideIcon> = {
  hash: Hash,
  gauge: Gauge,
  'mouse-pointer-click': MousePointerClick,
  lightbulb: Lightbulb,
  plug: Plug,
  type: Type,
  square: Square,
  circle: Circle,
  minus: Minus,
  image: ImageIcon,
  percent: Percent,
  layers: Layers,
  droplet: Droplet,
  'layout-dashboard': LayoutDashboard,
  'badge-check': BadgeCheck,
  clock: Clock,
  'function-square': FunctionSquare,
  'trending-up': TrendingUp,
  'bar-chart-3': BarChart3,
  'table-2': Table2,
  'alert-triangle': AlertTriangle,
  'toggle-left': ToggleLeft,
  'sliders-horizontal': SlidersHorizontal,
  'text-cursor-input': TextCursorInput,
  'chevron-down': ChevronDown,
  'arrow-right': ArrowRight,
  zap: Zap,
  cable: Cable,
  tag: Tag,
  crosshair: Crosshair,
  'layout-panel-top': LayoutPanelTop,
  triangle: Triangle,
  'folder-open': FolderOpen,
  map: Map,
  'play-circle': PlayCircle,
  'traffic-cone': TrafficCone,
  box: LayoutPanelTop,
  globe: Type,
};

export function resolveRegistryIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Hash;
}

/** Convert registry definition → legacy ToolDef for makeObject / palette. */
export function widgetDefToToolDef(def: WidgetDefinition): ToolDef {
  const objectType = def.objectType as ToolDef['type'];
  const key = registryToolKey(def);
  return {
    key: key !== objectType ? key : undefined,
    type: objectType,
    label: def.display.label,
    hint: def.display.hint,
    icon: resolveRegistryIcon(def.display.icon),
    color: def.display.color,
    width: def.defaults.width,
    height: def.defaults.height,
    text: def.defaults.text,
    name: def.defaults.name,
    style: def.defaults.style,
  };
}

export function registryPlacementKey(toolKey: string): string {
  return toolKey;
}
