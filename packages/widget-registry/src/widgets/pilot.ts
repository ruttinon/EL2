import type { WidgetDefinition } from '../types.js';

export const valueWidget: WidgetDefinition = {
  id: 'value',
  version: 1,
  objectType: 'value',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Value',
    icon: 'hash',
    color: '#0ea5e9',
    hint: 'แสดงค่า tag + หน่วย',
    keywords: ['numeric', 'tag', 'kpi'],
  },
  defaults: {
    width: 190,
    height: 72,
    text: 'Power',
    style: {
      transparentBg: true,
      fill: 'transparent',
      background: 'transparent',
      strokeWidth: 0,
      color: '#e2e8f0',
      unit: 'kW',
      decimalPlaces: 2,
      fontSize: 18,
      valueVariant: 'minimal',
    },
    binding: { decimalPlaces: 2, unit: 'kW' },
  },
  capabilities: ['bind:scalar', 'style:typography', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'thresholds', 'animation', 'effects'],
    dedicatedInspector: 'value',
  },
};

export const gaugeWidget: WidgetDefinition = {
  id: 'gauge',
  version: 1,
  objectType: 'gauge',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Gauge',
    icon: 'gauge',
    color: '#f59e0b',
    hint: 'Analog Gauge min/max',
    keywords: ['dial', 'analog'],
  },
  defaults: {
    width: 180,
    height: 120,
    text: 'Gauge',
    style: { min: 0, max: 100, unit: '%', fill: '#ffffff' },
    binding: { decimalPlaces: 1 },
  },
  capabilities: ['bind:scalar', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'effects'],
    dedicatedInspector: 'gauge',
  },
};

export const buttonWidget: WidgetDefinition = {
  id: 'button',
  version: 1,
  objectType: 'button',
  category: 'controls',
  paletteGroup: 'action',
  display: {
    label: 'Button',
    icon: 'mouse-pointer-click',
    color: '#ec4899',
    hint: 'Click to write value to tag',
  },
  defaults: {
    width: 160,
    height: 54,
    text: 'Start',
    style: {
      buttonActionMode: 'write',
      fill: '#ec4899',
      background: '#ec4899',
      color: '#ffffff',
      stroke: '#db2777',
      fontSize: 14,
      writeValue: '1',
    },
  },
  capabilities: ['bind:scalar', 'interact:write', 'interact:navigate', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'interaction', 'navigation', 'effects'],
    dedicatedInspector: 'button',
  },
};

/**
 * Unified status indicator — lamp (ON/OFF) or text badge (multi-state).
 * Binds to device first; tag is inferred from device tags.
 */
export const statusWidget: WidgetDefinition = {
  id: 'status',
  version: 1,
  objectType: 'status',
  category: 'values',
  paletteGroup: 'display',
  display: {
    label: 'Status',
    icon: 'badge-check',
    color: '#14b8a6',
    hint: 'Status ON/OFF — สี · Image · Model 3D Can be',
    keywords: ['led', 'lamp', 'indicator', 'statusbadge', 'online', 'offline'],
  },
  defaults: {
    width: 40,
    height: 40,
    style: {
      statusVariant: 'lamp',
      onColor: '#22c55e',
      offColor: '#94a3b8',
      fill: '#1e293b',
      badgeMap: '0:Offline:#94a3b8,1:Online:#22c55e,2:Fault:#ef4444',
    },
  },
  capabilities: ['bind:scalar', 'animate:value', 'style:chrome'],
  aliases: ['led', 'lamp', 'statusbadge'],
  inspector: {
    groups: ['layout', 'animation', 'effects'],
    dedicatedInspector: 'status',
  },
};

export const elecSymbolWidget: WidgetDefinition = {
  id: 'elecsymbol',
  version: 1,
  objectType: 'elecsymbol',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  display: {
    label: 'Elec Symbol',
    icon: 'plug',
    color: '#f59e0b',
    hint: 'Breaker, transformer, motor…',
    keywords: ['sld', 'breaker'],
  },
  paletteVisible: false,
  defaults: {
    width: 72,
    height: 72,
    text: 'CB-01',
    style: { symbolId: 'breaker' },
  },
  capabilities: ['bind:scalar', 'bind:flow', 'ports', 'style:typography', 'animate:value'],
  inspector: {
    groups: ['layout', 'typography', 'stroke', 'animation', 'effects'],
    dedicatedInspector: 'elecsymbol',
  },
};

export const PILOT_WIDGETS: WidgetDefinition[] = [
  valueWidget,
  gaugeWidget,
  buttonWidget,
  statusWidget,
  elecSymbolWidget,
];
