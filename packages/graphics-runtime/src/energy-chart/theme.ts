import type { EnergyChartOptions } from './types.js';

export const ENERGY_CHART_COLORS = [
  '#087c8b', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e',
  '#06b6d4', '#ec4899', '#f97316', '#a3e635', '#14b8a6',
];

export type EnergyChartTheme = {
  colors: string[];
  backgroundColor: string;
  titleColor: string;
  axisColor: string;
  gridColor: string;
  fontSize: number;
};

export const ENERGY_CHART_THEME: EnergyChartTheme = {
  colors: ENERGY_CHART_COLORS,
  backgroundColor: 'transparent',
  titleColor: '#173047',
  axisColor: '#6b7c8c',
  gridColor: '#e2edf2',
  fontSize: 9,
};

let activeTheme: EnergyChartTheme = { ...ENERGY_CHART_THEME };

/** Global defaults (like library-wide setOptions). */
export function setEnergyChartTheme(theme: Partial<EnergyChartTheme>): void {
  activeTheme = { ...activeTheme, ...theme };
}

export function getEnergyChartTheme(): EnergyChartTheme {
  return activeTheme;
}

export function mergeChartOptions(
  base: Partial<EnergyChartOptions>,
  override: EnergyChartOptions,
): EnergyChartOptions {
  return {
    ...base,
    ...override,
    chart: { ...base.chart, ...override.chart },
    title: { ...base.title, ...override.title },
    legend: { ...base.legend, ...override.legend },
    plotOptions: { ...base.plotOptions, ...override.plotOptions },
    colors: override.colors ?? base.colors ?? activeTheme.colors,
  };
}
