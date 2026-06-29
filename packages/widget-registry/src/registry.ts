import type { WidgetCategoryMeta, WidgetDefinition } from './types.js';
import { PILOT_WIDGETS } from './widgets/pilot.js';
import { PHASE2_WIDGETS } from './widgets/phase2.js';
import { PHASE2B_WIDGETS } from './widgets/phase2b.js';
import { PHASE3_WIDGETS } from './widgets/phase3.js';
import { PHASE4_WIDGETS } from './widgets/phase4.js';
import { PHASE5_WIDGETS } from './widgets/phase5.js';

const REGISTRY = new Map<string, WidgetDefinition>();

function register(def: WidgetDefinition) {
  REGISTRY.set(def.id, def);
  for (const alias of def.aliases ?? []) {
    REGISTRY.set(alias, def);
  }
}

for (const w of [...PILOT_WIDGETS, ...PHASE2_WIDGETS, ...PHASE2B_WIDGETS, ...PHASE3_WIDGETS, ...PHASE4_WIDGETS, ...PHASE5_WIDGETS]) {
  register(w);
}

export const WIDGET_CATEGORIES: WidgetCategoryMeta[] = [
  { id: 'layout', label: 'Layout', paletteGroup: 'display', icon: 'layout-panel-top' },
  { id: 'values', label: 'Values', paletteGroup: 'display', icon: 'hash' },
  { id: 'charts', label: 'Charts', paletteGroup: 'display', icon: 'bar-chart-3' },
  { id: 'tables', label: 'Tables', paletteGroup: 'display', icon: 'table-2' },
  { id: 'symbols.electrical', label: 'Electrical', paletteGroup: 'display', icon: 'zap' },
  { id: 'media', label: 'Media', paletteGroup: 'display', icon: 'play-circle' },
  { id: 'controls', label: 'Controls', paletteGroup: 'action', icon: 'mouse-pointer-click' },
  { id: 'navigation', label: 'Navigation', paletteGroup: 'action', icon: 'arrow-right' },
  /** Legacy 3D/effects — kept for runtime, not shown in palette */
  { id: 'effects', label: 'Effects / 3D', paletteGroup: 'display', icon: 'box' },
];

/** Preferred widget order within palette categories (matches SCADA/HMI library). */
const PALETTE_WIDGET_ORDER: Partial<Record<WidgetCategoryMeta['id'], string[]>> = {
  layout: ['text', 'rectangle', 'circle', 'polygon', 'line', 'image', 'panel', 'group'],
  values: ['value', 'gauge', 'progressbar', 'kpicard', 'multistate', 'semaphore', 'status', 'clock', 'formulavalue'],
  charts: ['echart', 'trend'],
  tables: ['tagtable', 'alarmtable'],
  'symbols.electrical': ['elecsymbol', 'flowpath', 'bussection', 'feedlabel', 'zone2d', 'hotspot'],
  media: ['video', 'iframe'],
  controls: ['button', 'switch', 'slider', 'inputfield', 'dropdown'],
  navigation: ['tabbar'],
};

function isPaletteVisible(def: WidgetDefinition): boolean {
  return def.paletteVisible !== false;
}

function sortPaletteWidgets(a: WidgetDefinition, b: WidgetDefinition): number {
  const order = PALETTE_WIDGET_ORDER[a.category];
  if (order) {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
  }
  return a.display.label.localeCompare(b.display.label);
}

export function getWidgetDefinition(id: string): WidgetDefinition | undefined {
  return REGISTRY.get(id);
}

export function getWidgetByObjectType(objectType: string): WidgetDefinition | undefined {
  const direct = getWidgetDefinition(objectType);
  if (direct && (direct.objectType === objectType || direct.aliases?.includes(objectType))) {
    return direct;
  }
  for (const def of listRegistryWidgets()) {
    if (def.objectType === objectType) return def;
    if (def.aliases?.includes(objectType)) return def;
  }
  return undefined;
}

export function listRegistryWidgets(): WidgetDefinition[] {
  const seen = new Set<string>();
  const out: WidgetDefinition[] = [];
  for (const def of REGISTRY.values()) {
    if (seen.has(def.id)) continue;
    seen.add(def.id);
    out.push(def);
  }
  return out.sort((a, b) => a.display.label.localeCompare(b.display.label));
}

/** Widgets shown in editor palette — excludes hidden 3D/builder tools. */
export function listPaletteWidgets(): WidgetDefinition[] {
  return listRegistryWidgets().filter(isPaletteVisible).sort(sortPaletteWidgets);
}

export function listWidgetsByCategory(category: WidgetCategoryMeta['id']): WidgetDefinition[] {
  return listPaletteWidgets().filter((w) => w.category === category);
}

export function isRegistryWidget(typeOrId: string): boolean {
  return Boolean(getWidgetByObjectType(typeOrId) ?? getWidgetDefinition(typeOrId));
}

export function registryToolKey(def: WidgetDefinition): string {
  return String(def.id);
}

/** Palette categories that have at least one visible registry widget */
export function registryPaletteCategories(): WidgetCategoryMeta[] {
  const ids = new Set(listPaletteWidgets().map((w) => w.category));
  return WIDGET_CATEGORIES.filter((c) => ids.has(c.id));
}
