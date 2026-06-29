import type { WidgetDefinition } from '../types.js';

/** Phase 2b — charts, tables, formula. */
export const trendWidget: WidgetDefinition = {
  id: 'trend',
  version: 1,
  objectType: 'trend',
  category: 'charts',
  paletteGroup: 'display',
  display: {
    label: 'Trend',
    icon: 'trending-up',
    color: '#8b5cf6',
    hint: 'SCADA Trend Graph — select multiple tags',
  },
  defaults: {
    width: 320,
    height: 160,
    text: 'Trend',
    style: { chartPeriod: '24h' },
  },
  capabilities: ['bind:timeseries', 'bind:multi', 'style:chrome'],
  inspector: {
    groups: ['layout'],
    dedicatedInspector: 'chart',
  },
};

export const echartWidget: WidgetDefinition = {
  id: 'echart',
  version: 1,
  objectType: 'echart',
  category: 'charts',
  paletteGroup: 'display',
  display: {
    label: 'Chart',
    icon: 'bar-chart-3',
    color: '#a855f7',
    hint: '2D / 3D Graph — bind tag and enable Live preview',
  },
  defaults: {
    width: 320,
    height: 200,
    text: 'Chart',
    style: { echartType: 'line', chartPeriod: '24h' },
  },
  capabilities: ['bind:timeseries', 'bind:multi', 'style:chrome'],
  inspector: {
    groups: ['layout'],
    dedicatedInspector: 'chart',
  },
};

export const tagtableWidget: WidgetDefinition = {
  id: 'tagtable',
  version: 1,
  objectType: 'tagtable',
  category: 'tables',
  paletteGroup: 'display',
  display: {
    label: 'Tag Table',
    icon: 'table-2',
    color: '#10b981',
    hint: 'Data grid showing values for multiple tags',
  },
  defaults: {
    width: 360,
    height: 220,
    text: 'Tags',
    style: { columns: 'name,value,unit', maxRows: 10 },
  },
  capabilities: ['bind:multi', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout'],
    dedicatedInspector: 'table',
  },
};

export const alarmtableWidget: WidgetDefinition = {
  id: 'alarmtable',
  version: 1,
  objectType: 'alarmtable',
  category: 'tables',
  paletteGroup: 'display',
  display: {
    label: 'Alarm Table',
    icon: 'alert-triangle',
    color: '#ef4444',
    hint: 'Real-time alarm list',
  },
  defaults: {
    width: 400,
    height: 200,
    text: 'Alarms',
    style: { maxRows: 10, alarmSeverityFilter: 'all' },
  },
  capabilities: ['bind:alarm', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout'],
    dedicatedInspector: 'table',
  },
};

export const formulavalueWidget: WidgetDefinition = {
  id: 'formulavalue',
  version: 1,
  objectType: 'formulavalue',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Formula',
    icon: 'function-square',
    color: '#8b5cf6',
    hint: 'Calculates value from multiple tags (A+B...)',
  },
  paletteVisible: false,
  defaults: {
    width: 200,
    height: 72,
    text: 'Formula',
    style: { formula: 'A', unit: '', decimalPlaces: 2 },
    binding: { decimalPlaces: 2 },
  },
  capabilities: ['bind:formula', 'bind:multi', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout', 'typography', 'appearance'],
    dedicatedInspector: 'value',
  },
};

export const PHASE2B_WIDGETS: WidgetDefinition[] = [
  trendWidget,
  echartWidget,
  tagtableWidget,
  alarmtableWidget,
  formulavalueWidget,
];
