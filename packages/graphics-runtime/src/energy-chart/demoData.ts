import type { EnergyChartOptions } from './types.js';
import { chartTypeUsesTrend, is3DChartType, isGaugeChartType } from './chartCatalog.js';

export const DEMO_CATEGORIES: NonNullable<EnergyChartOptions['categories']> = [
  { name: 'Jan', y: 42 },
  { name: 'Feb', y: 68 },
  { name: 'Mar', y: 55 },
  { name: 'Apr', y: 81 },
  { name: 'May', y: 63 },
];

export const DEMO_FUNNEL: NonNullable<EnergyChartOptions['categories']> = [
  { name: 'Visit', y: 100 },
  { name: 'Download', y: 72 },
  { name: 'Consult', y: 48 },
  { name: 'Order', y: 26 },
];

export function demoSeries(): NonNullable<EnergyChartOptions['series']> {
  const now = Date.now();
  const pts = Array.from({ length: 12 }, (_, i) => ({
    x: new Date(now - (11 - i) * 3600_000).toISOString(),
    y: 40 + Math.round(Math.sin(i / 2) * 18 + i * 2),
  }));
  return [{ name: 'Series A', data: pts }];
}

export type DemoDataContext = {
  /** When false, never inject sample months/sine-wave data (live / bound-tag mode). */
  allowDemo?: boolean;
  boundTagCount?: number;
};

/** Fill sample data in editor when no live tags/trends bound yet. */
export function fillDemoData(
  options: EnergyChartOptions,
  hasLiveData: boolean,
  ctx: DemoDataContext = {},
): EnergyChartOptions {
  if (hasLiveData) return options;

  const allowDemo = ctx.allowDemo !== false;
  const hasBoundTags = (ctx.boundTagCount ?? 0) > 0;
  const type = options.chart.type;
  const categories = options.categories?.length ? options.categories : undefined;

  // Tags bound or live mode — keep real labels; don't replace with Jan/Feb demo.
  if (!allowDemo || hasBoundTags) {
    if (isGaugeChartType(type)) {
      return { ...options, value: options.value ?? 0 };
    }
    if (chartTypeUsesTrend(type)) {
      return options;
    }
    if (categories?.length) return options;
    return options;
  }

  if (isGaugeChartType(type)) {
    return {
      ...options,
      value: options.value ?? 68,
      categories: categories ?? DEMO_CATEGORIES.slice(0, 3),
    };
  }

  if (type === 'funnel3d' || type === 'pyramid3d') {
    return { ...options, categories: categories ?? DEMO_FUNNEL };
  }

  if (is3DChartType(type) || type === 'pie' || type === 'donut' || type === 'bar' || type === 'bar-h') {
    return { ...options, categories: categories ?? DEMO_CATEGORIES };
  }

  if (chartTypeUsesTrend(type) && !(options.series?.some((s) => s.data.length))) {
    return { ...options, series: demoSeries() };
  }

  return options;
}

export function chartHasLiveData(input: {
  chartType: string;
  tagIds?: string[];
  valuesByTag?: Map<string, { value?: unknown }>;
  series?: Array<{ points: unknown[] }>;
  value?: number;
}): boolean {
  if (input.series?.some((s) => s.points.length > 0)) return true;

  const ids = input.tagIds ?? [];
  const map = input.valuesByTag;

  if (chartTypeUsesTrend(input.chartType as EnergyChartOptions['chart']['type'])) {
    return false;
  }

  if (isGaugeChartType(input.chartType as EnergyChartOptions['chart']['type'])) {
    if (ids.length && map) {
      return ids.some((id) => {
        const v = map.get(id)?.value;
        return v != null && Number.isFinite(Number(v));
      });
    }
    return false;
  }

  if (!ids.length || !map) return false;
  return ids.some((id) => {
    const v = map.get(id)?.value;
    return v != null && Number.isFinite(Number(v));
  });
}
