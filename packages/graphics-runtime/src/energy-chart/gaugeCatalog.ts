import type { EnergyChartType } from './types.js';

export type GaugeStyleId =
  | 'classic'
  | 'speedometer'
  | 'solid'
  | 'dual'
  | 'kpi-rings'
  | 'vu'
  | 'bullet';

export type GaugeCatalogEntry = {
  id: GaugeStyleId;
  label: string;
  /** ใช้หลาย tag (วง KPI / bullet) */
  multiTag?: boolean;
};

export const GAUGE_STYLE_CATALOG: GaugeCatalogEntry[] = [
  { id: 'classic', label: 'Classic SVG' },
  { id: 'speedometer', label: 'Speedometer' },
  { id: 'solid', label: 'Solid gauge' },
  { id: 'dual', label: 'Dual scale', multiTag: true },
  { id: 'kpi-rings', label: 'KPI rings', multiTag: true },
  { id: 'vu', label: 'VU meter', multiTag: true },
  { id: 'bullet', label: 'Bullet graph', multiTag: true },
];

export function isGaugeStyleId(raw: string): raw is GaugeStyleId {
  return GAUGE_STYLE_CATALOG.some((g) => g.id === raw);
}

export function gaugeStyleUsesMultiTag(style: string | undefined): boolean {
  const entry = GAUGE_STYLE_CATALOG.find((g) => g.id === style);
  return Boolean(entry?.multiTag);
}

/** Map widget `gaugeStyle` → internal EnergyChart builder type (null = classic SVG). */
export function gaugeStyleToChartType(style: string | undefined): EnergyChartType | null {
  const id = style && isGaugeStyleId(style) ? style : 'classic';
  if (id === 'classic') return null;
  if (id === 'bullet') return 'bullet';
  return `gauge-${id}` as EnergyChartType;
}

/** Migrate legacy echart gauge types → line chart */
export function migrateLegacyEchartType(raw: string | undefined): string {
  if (!raw || raw === 'gauge') return 'line';
  if (raw.startsWith('gauge-') || raw === 'bullet') return 'line';
  return raw;
}
