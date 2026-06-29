export type {
  EnergyChartType,
  EnergyChartOptions,
  EnergyChartSeries,
  EnergyChartCategoryItem,
  EnergyChartInstance,
  EnergyChartPoint,
} from './types.js';

export {
  ENERGY_CHART_COLORS,
  ENERGY_CHART_THEME,
  getEnergyChartTheme,
  setEnergyChartTheme,
  mergeChartOptions,
} from './theme.js';
export type { EnergyChartTheme } from './theme.js';

export { buildEChartsOption } from './buildOption.js';
export { createEnergyChart } from './createChart.js';
export {
  ENERGY_CHART_CATALOG,
  ENERGY_CHART_TYPES,
  CHART_CATALOG_GROUPS,
  catalogForGroup,
  normalizeChartType,
  isEnergyChartType,
  isGaugeChartType,
  is3DChartType,
  chartTypeUsesTrend,
} from './chartCatalog.js';
export type { ChartCatalogEntry, ChartCatalogGroup } from './chartCatalog.js';
export {
  GAUGE_STYLE_CATALOG,
  isGaugeStyleId,
  gaugeStyleUsesMultiTag,
  gaugeStyleToChartType,
} from './gaugeCatalog.js';
export type { GaugeStyleId, GaugeCatalogEntry } from './gaugeCatalog.js';
export { runtimeToChartOptions, resolveChartType } from './fromRuntime.js';
export type { RuntimeChartInput } from './fromRuntime.js';

export { EnergyChart } from './EnergyChart.js';
export type { EnergyChartProps } from './EnergyChart.js';
