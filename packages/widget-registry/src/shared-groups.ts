import type { InspectorFieldDef, InspectorGroupId } from './types.js';

export type SharedInspectorGroup = {
  id: InspectorGroupId;
  title: string;
  tier: 'essential' | 'data' | 'advanced';
  collapsed?: boolean;
  fields: InspectorFieldDef[];
};

export const SHARED_INSPECTOR_GROUPS: Record<InspectorGroupId, SharedInspectorGroup> = {
  layout: {
    id: 'layout',
    title: 'Layout',
    tier: 'essential',
    fields: [
      { id: 'name', type: 'text', label: 'Name', path: 'name', placeholder: 'Widget name' },
      { id: 'x', type: 'number', label: 'X', path: 'x' },
      { id: 'y', type: 'number', label: 'Y', path: 'y' },
      { id: 'width', type: 'number', label: 'Width', path: 'width', min: 1 },
      { id: 'height', type: 'number', label: 'Height', path: 'height', min: 1 },
      { id: 'layer', type: 'number', label: 'Z-index', path: 'layer' },
      { id: 'visible', type: 'toggle', label: 'Visible', path: 'visible' },
      { id: 'locked', type: 'toggle', label: 'Locked', path: 'locked' },
    ],
  },
  transform: {
    id: 'transform',
    title: 'Transform',
    tier: 'advanced',
    collapsed: true,
    fields: [
      { id: 'rotate', type: 'number', label: 'Rotate °', path: 'style.rotate', min: 0, max: 360 },
      { id: 'lockAspect', type: 'toggle', label: 'Lock aspect', path: 'style.lockAspectRatio' },
    ],
  },
  appearance: {
    id: 'appearance',
    title: 'Appearance',
    tier: 'essential',
    fields: [
      { id: 'opacity', type: 'number', label: 'Opacity', path: 'style.opacity', min: 0, max: 1, step: 0.05 },
      { id: 'fill', type: 'color', label: 'Fill', path: 'style.fill' },
      { id: 'fillColor2', type: 'color', label: 'Gradient To', path: 'style.fillColor2' },
      {
        id: 'gradientDirection',
        type: 'select',
        label: 'Direction',
        path: 'style.gradientDirection',
        options: [
          { value: 'to bottom', label: 'Top to Bottom' },
          { value: 'to right', label: 'Left to Right' },
          { value: 'to bottom right', label: 'Diagonal' },
          { value: 'radial', label: 'Radial' },
        ],
      },
      { id: 'stroke', type: 'color', label: 'Stroke', path: 'style.stroke' },
      { id: 'strokeWidth', type: 'number', label: 'Stroke W', path: 'style.strokeWidth', min: 0 },
      { id: 'radius', type: 'number', label: 'Radius', path: 'style.borderRadius', min: 0 },
    ],
  },
  typography: {
    id: 'typography',
    title: 'Typography',
    tier: 'essential',
    fields: [
      { id: 'text', type: 'text', label: 'Label', path: 'text' },
      {
        id: 'fontFamily',
        type: 'combobox',
        label: 'Font',
        path: 'style.fontFamily',
        placeholder: 'Select Font...',
        options: [
          { value: '', label: 'Default (System)' },
          { value: 'Inter, sans-serif', label: 'Inter' },
          { value: 'Roboto, sans-serif', label: 'Roboto' },
          { value: '"Open Sans", sans-serif', label: 'Open Sans' },
          { value: 'Lato, sans-serif', label: 'Lato' },
          { value: 'Montserrat, sans-serif', label: 'Montserrat' },
          { value: 'Sarabun, sans-serif', label: 'Sarabun' },
          { value: 'Prompt, sans-serif', label: 'Prompt' },
          { value: 'Kanit, sans-serif', label: 'Kanit' },
          { value: 'Mitr, sans-serif', label: 'Mitr' },
          { value: 'Chakra Petch, sans-serif', label: 'Chakra Petch' },
          { value: 'Krub, sans-serif', label: 'Krub' },
          { value: 'Arial, sans-serif', label: 'Arial' },
          { value: 'Helvetica, sans-serif', label: 'Helvetica' },
          { value: 'Tahoma, sans-serif', label: 'Tahoma' },
          { value: 'Verdana, sans-serif', label: 'Verdana' },
          { value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', label: 'Segoe UI' },
          { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
          { value: 'Georgia, serif', label: 'Georgia' },
          { value: 'Garamond, serif', label: 'Garamond' },
          { value: '"Courier New", Courier, monospace', label: 'Courier New' },
          { value: 'Consolas, monospace', label: 'Consolas' },
          { value: '"Lucida Console", Monaco, monospace', label: 'Lucida Console' },
          { value: 'Impact, Charcoal, sans-serif', label: 'Impact' },
          { value: '"Comic Sans MS", cursive, sans-serif', label: 'Comic Sans MS' },
          { value: '"Trebuchet MS", Helvetica, sans-serif', label: 'Trebuchet MS' },
          { value: 'Arial Black, Gadget, sans-serif', label: 'Arial Black' }
        ],
      },
      {
        id: 'fontWeight',
        type: 'select',
        label: 'Weight',
        path: 'style.fontWeight',
        options: [
          { value: 'normal', label: 'Normal' },
          { value: 'bold', label: 'Bold' },
          { value: '100', label: 'Thin (100)' },
          { value: '300', label: 'Light (300)' },
          { value: '500', label: 'Medium (500)' },
          { value: '600', label: 'Semi Bold (600)' },
          { value: '800', label: 'Extra Bold (800)' },
          { value: '900', label: 'Black (900)' },
        ],
      },
      { id: 'fontStyle', type: 'toggle', label: 'Italic', path: 'style.isItalic' },
      { id: 'fontSize', type: 'number', label: 'Size', path: 'style.fontSize', min: 8, max: 96 },
      { id: 'color', type: 'color', label: 'Text color', path: 'style.color' },
      {
        id: 'align',
        type: 'segmented',
        label: 'Align',
        path: 'style.align',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
      },
    ],
  },
  stroke: {
    id: 'stroke',
    title: 'Stroke',
    tier: 'essential',
    fields: [
      { id: 'stroke', type: 'color', label: 'Color', path: 'style.stroke' },
      { id: 'strokeWidth', type: 'number', label: 'Width', path: 'style.strokeWidth', min: 0 },
    ],
  },
  data: {
    id: 'data',
    title: 'Data Binding',
    tier: 'data',
    fields: [
      { id: 'tag', type: 'tag', label: 'Tag', path: 'binding.tagId' },
      { id: 'unit', type: 'text', label: 'Unit', path: 'binding.unit', placeholder: 'kW, °C' },
      { id: 'decimals', type: 'number', label: 'Decimals', path: 'binding.decimalPlaces', min: 0, max: 6 },
      { id: 'min', type: 'number', label: 'Min', path: 'style.min' },
      { id: 'max', type: 'number', label: 'Max', path: 'style.max' },
      { id: 'formulaEnabled', type: 'toggle', label: 'Use Formula', path: 'style.formulaEnabled' },
      { id: 'formula', type: 'text', label: 'Formula', path: 'style.formula', placeholder: 'A + B * Tag' },
      { id: 'tagIdA', type: 'tag', label: 'Variable A', path: 'binding.tagIdA' },
      { id: 'tagIdB', type: 'tag', label: 'Variable B', path: 'binding.tagIdB' },
      { id: 'tagIdC', type: 'tag', label: 'Variable C', path: 'binding.tagIdC' },
    ],
  },
  thresholds: {
    id: 'thresholds',
    title: 'Thresholds',
    tier: 'advanced',
    collapsed: true,
    fields: [
      { id: 'thresholdHigh', type: 'number', label: 'High Limit', path: 'style.thresholdHigh' },
      { id: 'alarmColor', type: 'color', label: 'High Color', path: 'style.alarmColor' },
      { id: 'thresholdLow', type: 'number', label: 'Low Limit', path: 'style.thresholdLow' },
      { id: 'warningColor', type: 'color', label: 'Low Color', path: 'style.warningColor' },
    ],
  },
  interaction: {
    id: 'interaction',
    title: 'Actions',
    tier: 'data',
    fields: [
      { id: 'writeValue', type: 'text', label: 'Write value', path: 'style.writeValue', placeholder: '1 / true' },
      {
        id: 'confirmWrite',
        type: 'toggle',
        label: 'Confirm',
        path: 'style.confirmWrite',
      },
    ],
  },
  animation: {
    id: 'animation',
    title: 'Animation',
    tier: 'advanced',
    collapsed: true,
    fields: [
      { id: 'blinkWhenAlarm', type: 'toggle', label: 'Blink on Alarm', path: 'style.blinkWhenAlarm' },
      {
        id: 'alarmBlinkSpeed',
        type: 'select',
        label: 'Blink Speed',
        path: 'style.alarmBlinkSpeed',
        options: [
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
        ],
      },
    ],
  },
  navigation: {
    id: 'navigation',
    title: 'Navigation',
    tier: 'data',
    fields: [
      { id: 'navTo', type: 'text', label: 'Graphic ID', path: 'navigateTo' },
    ],
  },
  effects: {
    id: 'effects',
    title: 'Shadows & Effects',
    tier: 'advanced',
    collapsed: true,
    fields: [
      { id: 'shadowColor', type: 'color', label: 'Shadow Color', path: 'style.shadowColor' },
      { id: 'shadowBlur', type: 'number', label: 'Blur', path: 'style.shadowBlur', min: 0 },
      { id: 'shadowOffsetX', type: 'number', label: 'Offset X', path: 'style.shadowOffsetX' },
      { id: 'shadowOffsetY', type: 'number', label: 'Offset Y', path: 'style.shadowOffsetY' },
      { id: 'textShadowBlur', type: 'number', label: 'Text Blur', path: 'style.textShadowBlur', min: 0 },
    ],
  },
  advanced: {
    id: 'advanced',
    title: 'Advanced',
    tier: 'advanced',
    collapsed: true,
    fields: [],
  },
};

export function resolveInspectorGroups(refs: import('./types.js').InspectorGroupRef[]): SharedInspectorGroup[] {
  const out: SharedInspectorGroup[] = [];
  for (const ref of refs) {
    if (typeof ref === 'string') {
      const g = SHARED_INSPECTOR_GROUPS[ref];
      if (g) out.push(g);
    } else {
      out.push({
        id: 'advanced',
        title: ref.custom,
        tier: 'advanced',
        fields: ref.fields,
      });
    }
  }
  return out;
}
