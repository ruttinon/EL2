import type { EnergyChartType } from '@energylink/graphics-runtime';

export const CHART_TYPES = new Set([
  'trend', 'echart',
]);

export const CHART_TITLES: Record<string, string> = {
  trend: 'Trend Chart',
  echart: 'Chart',
};

export const CHART_PERIOD_OPTIONS = [
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
] as const;

export {
  ENERGY_CHART_CATALOG,
  CHART_CATALOG_GROUPS,
  catalogForGroup,
} from '@energylink/graphics-runtime';

/** @deprecated use catalogForGroup */
export const ECHART_TYPE_OPTIONS = [
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'bar', label: 'Column' },
  { value: 'bar-h', label: 'Bar Horizontal' },
  { value: 'pie', label: 'Pie' },
  { value: 'donut', label: 'Donut' },
] as const;

export function isChartType(type: string): boolean {
  return CHART_TYPES.has(type);
}

export function chartUsesPeriod(type: string, echartType?: string): boolean {
  if (type === 'trend') return true;
  if (type !== 'echart') return false;
  const ct = (echartType ?? 'line') as EnergyChartType;
  return ct === 'line' || ct === 'area';
}

export function chartUsesMultiTags(type: string, _echartType?: string): boolean {
  return type === 'trend' || type === 'echart';
}
