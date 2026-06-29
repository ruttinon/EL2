import type { GraphicObjectDefinition } from '@energylink/shared-types';

export type ViewportDebugFlags = {
  walls: boolean;
  cables: boolean;
  labels: boolean;
  widgets: boolean;
  flow: boolean;
};

export const DEFAULT_VIEWPORT_DEBUG: ViewportDebugFlags = {
  walls: true,
  cables: true,
  labels: true,
  widgets: true,
  flow: true,
};

const WIDGET_TYPES = new Set([
  'value', 'gauge', 'trend', 'sparkline', 'barchart', 'piechart', 'kpicard', 'formulavalue',
  'statusbadge', 'alarm', 'alarmtable', 'tagtable', 'clock', 'led', 'multistate', 'echart',
  'progressbar', 'semaphore', 'levelbar',
]);

export function passesViewportDebug(obj: GraphicObjectDefinition, debug: ViewportDebugFlags): boolean {
  if (obj.type === 'wall' || obj.type === 'zone3d' || obj.type === 'zone2d') return debug.walls;
  if (obj.type === 'cable3d' || obj.type === 'flowpath' || obj.type === 'pipe') return debug.cables;
  if (obj.type === 'text' || obj.type === 'feedlabel') return debug.labels;
  if (WIDGET_TYPES.has(obj.type)) return debug.widgets;
  return true;
}
