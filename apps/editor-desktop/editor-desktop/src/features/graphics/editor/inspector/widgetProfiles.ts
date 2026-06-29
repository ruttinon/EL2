/**
 * Industrial widget profiles — single source of truth for which inspector
 * sections apply to each widget type (premium SCADA/HMI pattern).
 */

export type InspectorTier = 'essential' | 'data' | 'equipment' | 'advanced';

export type WidgetProfile = {
  label: string;
  tagline: string;
  tiers: InspectorTier[];
  dedicatedAppearance: boolean;
  inlineBinding: boolean;
};

const VALUE_TYPES_LIST = [
  'value', 'gauge', 'progressbar', 'levelbar', 'led', 'semaphore',
  'multistate', 'statusbadge', 'kpicard', 'formulavalue',
] as const;

export const WIDGET_PROFILES: Partial<Record<string, WidgetProfile>> = {
  image: {
    label: 'Image',
    tagline: 'Upload PNG/JPG/WebP/SVG/GIF — Free or boxed',
    tiers: ['essential', 'data', 'equipment', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: false,
  },
  video: {
    label: 'Video',
    tagline: 'Upload clip or stream URL (HLS/MJPEG/RTSP)',
    tiers: ['essential', 'data', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: false,
  },
  ...Object.fromEntries(
    VALUE_TYPES_LIST.map((t) => [
      t,
      {
        label: t,
        tagline: 'Bind Tag · Adjust appearance · Additional settings as needed',
        tiers: ['essential', 'advanced'] as InspectorTier[],
        dedicatedAppearance: true,
        inlineBinding: true,
      },
    ]),
  ),
  trend: {
    label: 'Trend Chart',
    tagline: 'Select tags · time range · color',
    tiers: ['essential', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: true,
  },
  barchart: {
    label: 'Bar Chart',
    tagline: 'Compare multiple tags',
    tiers: ['essential', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: true,
  },
  piechart: {
    label: 'Pie Chart',
    tagline: 'Proportion by tag value',
    tiers: ['essential', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: true,
  },
  sparkline: {
    label: 'Sparkline',
    tagline: 'Compact trend',
    tiers: ['essential', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: true,
  },
  echart: {
    label: 'EChart',
    tagline: 'Advanced ECharts',
    tiers: ['essential', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: true,
  },
  clock: {
    label: 'Clock',
    tagline: 'Digital / Analog / Compact',
    tiers: ['essential', 'advanced'],
    dedicatedAppearance: true,
    inlineBinding: false,
  },
};

export function widgetProfile(type: string): WidgetProfile | null {
  return WIDGET_PROFILES[type] ?? null;
}

export function hasDedicatedAppearance(type: string): boolean {
  return WIDGET_PROFILES[type]?.dedicatedAppearance === true;
}
