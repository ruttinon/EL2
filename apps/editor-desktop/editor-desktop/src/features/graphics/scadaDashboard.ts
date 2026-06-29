import type { GraphicObjectDefinition } from '@energylink/shared-types';

const SCADA_DASHBOARD_TYPES = new Set([
  'value', 'gauge', 'trend', 'sparkline', 'barchart', 'piechart', 'kpicard', 'formulavalue',
  'statusbadge', 'alarm', 'alarmtable', 'tagtable', 'clock', 'led', 'multistate', 'echart',
  'progressbar', 'semaphore', 'levelbar', 'button', 'switch', 'slider', 'inputfield', 'dropdown',
  'tabbar', 'navbutton', 'hotspot', 'panel', 'text',
]);

export function filterScadaDashboardObjects(objects: GraphicObjectDefinition[]): GraphicObjectDefinition[] {
  return objects.filter((o) => o.visible !== false && SCADA_DASHBOARD_TYPES.has(o.type));
}

export function countScadaWidgets(objects: GraphicObjectDefinition[]): number {
  return filterScadaDashboardObjects(objects).filter((o) => o.type !== 'panel' && o.type !== 'text').length;
}
