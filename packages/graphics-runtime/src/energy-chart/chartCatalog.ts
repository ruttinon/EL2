import type { EnergyChartType } from './types.js';

export type ChartCatalogGroup = '2d' | '3d';

export type ChartCatalogEntry = {
  type: EnergyChartType;
  label: string;
  group: ChartCatalogGroup;
};

/** Chart types for widget `echart` — gauges live on widget `gauge`. */
export const ENERGY_CHART_CATALOG: ChartCatalogEntry[] = [
  { type: 'line', label: 'Line', group: '2d' },
  { type: 'area', label: 'Area', group: '2d' },
  { type: 'bar', label: 'Column', group: '2d' },
  { type: 'bar-h', label: 'Bar horizontal', group: '2d' },
  { type: 'pie', label: 'Pie', group: '2d' },
  { type: 'donut', label: 'Donut', group: '2d' },

  { type: 'column3d', label: '3D column', group: '3d' },
  { type: 'column3d-stack', label: '3D stacked', group: '3d' },
  { type: 'column3d-group', label: '3D grouped', group: '3d' },
  { type: 'cylinder3d', label: '3D cylinder', group: '3d' },
  { type: 'pie3d', label: '3D pie', group: '3d' },
  { type: 'donut3d', label: '3D donut', group: '3d' },
  { type: 'scatter3d', label: '3D scatter', group: '3d' },
  { type: 'area3d', label: '3D area', group: '3d' },
  { type: 'funnel3d', label: '3D funnel', group: '3d' },
  { type: 'pyramid3d', label: '3D pyramid', group: '3d' },
];

export const ENERGY_CHART_TYPES = ENERGY_CHART_CATALOG.map((e) => e.type);

export const CHART_CATALOG_GROUPS: { id: ChartCatalogGroup; label: string }[] = [
  { id: '2d', label: '2D Charts' },
  { id: '3d', label: '3D Charts' },
];

export function catalogForGroup(group: ChartCatalogGroup): ChartCatalogEntry[] {
  return ENERGY_CHART_CATALOG.filter((e) => e.group === group);
}

export function isEnergyChartType(raw: string): raw is EnergyChartType {
  return ENERGY_CHART_TYPES.includes(raw as EnergyChartType);
}

export function isGaugeChartType(type: EnergyChartType): boolean {
  return type.startsWith('gauge-') || type === 'bullet';
}

export function is3DChartType(type: EnergyChartType): boolean {
  return type.includes('3d');
}

export function chartTypeUsesTrend(type: EnergyChartType): boolean {
  return type === 'line' || type === 'area';
}

export function normalizeChartType(raw: string | undefined): EnergyChartType {
  const migrated = migrateLegacyEchartType(raw);
  if (isEnergyChartType(migrated)) return migrated;
  return 'line';
}

function migrateLegacyEchartType(raw: string | undefined): string {
  if (!raw || raw === 'gauge') return 'line';
  if (raw.startsWith('gauge-') || raw === 'bullet') return 'line';
  return raw;
}
