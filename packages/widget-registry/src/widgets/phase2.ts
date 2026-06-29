import type { WidgetDefinition } from '../types.js';

/** Phase 2 — values & controls migrated from legacy objectCatalog. */
export const progressbarWidget: WidgetDefinition = {
  id: 'progressbar',
  version: 1,
  objectType: 'progressbar',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Progress',
    icon: 'percent',
    color: '#22c55e',
    hint: '% Bar by tag value — select device first',
  },
  paletteVisible: false,
  defaults: {
    width: 220,
    height: 28,
    style: { fill: '#22c55e', trackColor: '#e2e8f0', min: 0, max: 100, unit: '%', decimalPlaces: 0, barOrientation: 'horizontal' },
    binding: { decimalPlaces: 0, unit: '%' },
  },
  capabilities: ['bind:scalar', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'thresholds', 'animation', 'effects'],
    dedicatedInspector: 'value',
  },
};

export const levelbarWidget: WidgetDefinition = {
  id: 'levelbar',
  version: 1,
  objectType: 'levelbar',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Level Bar',
    icon: 'droplet',
    color: '#0891b2',
    hint: 'Vertical Level Bar — bind tag from device',
  },
  defaults: {
    width: 70,
    height: 220,
    style: { fill: '#0891b2', trackColor: '#e2e8f0', min: 0, max: 100, unit: '%', decimalPlaces: 1 },
    binding: { decimalPlaces: 1, unit: '%' },
  },
  capabilities: ['bind:scalar', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'thresholds', 'animation', 'effects'],
    dedicatedInspector: 'value',
  },
  paletteVisible: false,
};

export const kpicardWidget: WidgetDefinition = {
  id: 'kpicard',
  version: 1,
  objectType: 'kpicard',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'KPI Card',
    icon: 'layout-dashboard',
    color: '#0ea5e9',
    hint: 'KPI Card + delta — bind tag from device',
  },
  defaults: {
    width: 200,
    height: 120,
    text: 'KPI',
    style: { fill: '#f0f9ff', unit: 'kWh', decimalPlaces: 0 },
    binding: { decimalPlaces: 0, unit: 'kWh' },
  },
  capabilities: ['bind:scalar', 'style:typography', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'thresholds', 'animation', 'effects'],
    dedicatedInspector: 'value',
  },
};

export const multistateWidget: WidgetDefinition = {
  id: 'multistate',
  version: 1,
  objectType: 'multistate',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Multi-State',
    icon: 'layers',
    color: '#6366f1',
    hint: 'Text by tag value — SCADA set in Inspector',
  },
  paletteVisible: false,
  defaults: {
    width: 96,
    height: 96,
    text: 'Running',
    style: { states: 'Stopped,Running,Fault' },
  },
  capabilities: ['bind:scalar', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'animation', 'effects'],
    dedicatedInspector: 'value',
  },
};

export const semaphoreWidget: WidgetDefinition = {
  id: 'semaphore',
  version: 1,
  objectType: 'semaphore',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Semaphore',
    icon: 'traffic-cone',
    color: '#ef4444',
    hint: '3-Color Light: 0=Green, 1=Yellow, 2+=Red',
  },
  paletteVisible: false,
  defaults: {
    width: 60,
    height: 160,
    style: { semColorGreen: '#22c55e', semColorYellow: '#f59e0b', semColorRed: '#ef4444', fill: '#1e293b' },
  },
  capabilities: ['bind:scalar', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'animation', 'effects'],
    dedicatedInspector: 'value',
  },
};

export const clockWidget: WidgetDefinition = {
  id: 'clock',
  version: 1,
  objectType: 'clock',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Clock',
    icon: 'clock',
    color: '#0ea5e9',
    hint: 'Digital / Analog / Compact — no tag binding needed',
  },
  defaults: {
    width: 200,
    height: 72,
    style: { clockVariant: 'digital', clockFormat: 'local', clockTimeStyle: '24h', showSeconds: true },
  },
  capabilities: ['style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'effects'],
    dedicatedInspector: 'clock',
  },
};

export const switchWidget: WidgetDefinition = {
  id: 'switch',
  version: 1,
  objectType: 'switch',
  category: 'controls',
  paletteGroup: 'action',
  display: {
    label: 'Switch',
    icon: 'toggle-left',
    color: '#22c55e',
    hint: 'Toggle ON/OFF — select device and bind bool tag',
  },
  defaults: {
    width: 96,
    height: 44,
    text: 'OFF',
    style: { fill: '#e2e8f0', background: '#e2e8f0', stroke: '#94a3b8' },
  },
  capabilities: ['bind:scalar', 'interact:write', 'style:chrome'],
  inspector: {
    groups: ['layout', 'interaction', 'appearance', 'effects'],
    dedicatedInspector: 'switch',
  },
};

export const PHASE2_WIDGETS: WidgetDefinition[] = [
  progressbarWidget,
  levelbarWidget,
  kpicardWidget,
  multistateWidget,
  semaphoreWidget,
  clockWidget,
  switchWidget,
];
