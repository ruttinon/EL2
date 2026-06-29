import type { CurrentTagValue, TrendPoint } from '../types.js';
import { normalizeChartType } from './chartCatalog.js';
import { getEnergyChartTheme } from './theme.js';
import type { EnergyChartOptions, EnergyChartType } from './types.js';

export type RuntimeChartInput = {
  chartType: EnergyChartType;
  title?: string;
  series?: Array<{ label: string; points: TrendPoint[]; color?: string }>;
  items?: Array<{ label: string; value: number; color?: string }>;
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  tagIds?: string[];
  valuesByTag?: Map<string, CurrentTagValue>;
  showLegend?: boolean;
  primaryColor?: string;
};

/** Map SCADA widget runtime props → declarative EnergyChartOptions. */
export function runtimeToChartOptions(input: RuntimeChartInput): EnergyChartOptions {
  const tagIds = input.tagIds ?? [];
  const valuesByTag = input.valuesByTag;

  const categories = (() => {
    if (tagIds.length && valuesByTag) {
      return tagIds.map((tid) => {
        const tv = valuesByTag.get(tid);
        return { name: tv?.name ?? tid.slice(-8), y: tv?.value != null ? Number(tv.value) : 0 };
      });
    }
    return (input.items ?? []).map((i) => ({ name: i.label, y: i.value, color: i.color }));
  })();

  const liveValue = (() => {
    if (tagIds.length && valuesByTag) {
      const tv = valuesByTag.get(tagIds[0]!);
      if (tv?.value != null) return Number(tv.value);
    }
    return input.value ?? 0;
  })();

  const series = (input.series ?? []).map((s) => ({
    name: s.label,
    data: s.points.map((p) => ({ x: p.readAt, y: p.value != null ? Number(p.value) : null })),
    color: s.color,
  }));

  return {
    chart: { type: input.chartType },
    title: input.title ? { text: input.title } : undefined,
    colors: input.primaryColor ? [input.primaryColor, ...getEnergyChartTheme().colors.slice(1)] : undefined,
    yAxis: { min: input.min, max: input.max },
    series,
    categories,
    value: liveValue,
    unit: input.unit,
    legend: { enabled: input.showLegend !== false },
  };
}

export { normalizeChartType as resolveChartType };
