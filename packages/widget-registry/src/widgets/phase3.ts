import type { WidgetDefinition } from '../types.js';

/** Phase 3 — remaining controls migrated from legacy palette. */
export const sliderWidget: WidgetDefinition = {
  id: 'slider',
  version: 1,
  objectType: 'slider',
  category: 'controls',
  paletteGroup: 'action',
  display: {
    label: 'Slider',
    icon: 'sliders-horizontal',
    color: '#a855f7',
    hint: 'Continuous adjust — bind tag from device',
  },
  defaults: {
    width: 220,
    height: 40,
    style: { min: 0, max: 100, step: 1, unit: '%', decimalPlaces: 0 },
    binding: { decimalPlaces: 0 },
  },
  capabilities: ['bind:scalar', 'interact:write', 'style:chrome', 'animate:value'],
  inspector: {
    groups: ['layout', 'appearance', 'thresholds', 'animation'],
    dedicatedInspector: 'slider',
  },
};

export const inputfieldWidget: WidgetDefinition = {
  id: 'inputfield',
  version: 1,
  objectType: 'inputfield',
  category: 'controls',
  paletteGroup: 'action',
  display: {
    label: 'Input',
    icon: 'text-cursor-input',
    color: '#0ea5e9',
    hint: 'Input value and write to tag',
  },
  defaults: {
    width: 200,
    height: 44,
    text: '',
    style: { placeholder: 'Enter value…' },
  },
  capabilities: ['bind:scalar', 'interact:write', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'interaction'],
    dedicatedInspector: 'input',
  },
};

export const dropdownWidget: WidgetDefinition = {
  id: 'dropdown',
  version: 1,
  objectType: 'dropdown',
  category: 'controls',
  paletteGroup: 'action',
  display: {
    label: 'Dropdown',
    icon: 'chevron-down',
    color: '#6366f1',
    hint: 'Select option and write to tag',
  },
  defaults: {
    width: 200,
    height: 44,
    text: 'Choose...',
    style: { options: 'Auto,Manual,Off' },
  },
  capabilities: ['bind:scalar', 'interact:write', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout', 'typography', 'appearance', 'interaction'],
    dedicatedInspector: 'dropdown',
  },
};

export const navbuttonWidget: WidgetDefinition = {
  id: 'navbutton',
  version: 1,
  objectType: 'navbutton',
  category: 'navigation',
  paletteGroup: 'action',
  display: {
    label: 'Nav Button',
    icon: 'arrow-right',
    color: '#0d9488',
    hint: 'Click to navigate to another screen',
  },
  defaults: {
    width: 170,
    height: 50,
    text: 'Go to Screen',
  },
  capabilities: ['interact:navigate', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout', 'typography', 'appearance'],
    dedicatedInspector: 'nav',
  },
  paletteVisible: false,
};

export const tabbarWidget: WidgetDefinition = {
  id: 'tabbar',
  version: 1,
  objectType: 'tabbar',
  category: 'navigation',
  paletteGroup: 'action',
  display: {
    label: 'Tab Bar',
    icon: 'folder-open',
    color: '#6366f1',
    hint: 'Tab navigation — format Name:graphicId',
  },
  defaults: {
    width: 400,
    height: 44,
    text: 'Navigation',
    style: { tabs: 'Overview:graphic_main,Alarms:graphic_alarms' },
  },
  capabilities: ['interact:navigate', 'style:typography', 'style:chrome'],
  inspector: {
    groups: ['layout', 'appearance'],
    dedicatedInspector: 'tabbar',
  },
};

export const PHASE3_WIDGETS: WidgetDefinition[] = [
  sliderWidget,
  inputfieldWidget,
  dropdownWidget,
  navbuttonWidget,
  tabbarWidget,
];
