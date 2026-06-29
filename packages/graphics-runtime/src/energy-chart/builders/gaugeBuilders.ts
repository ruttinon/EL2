import type { EChartsOption } from 'echarts';
import { getEnergyChartTheme } from '../theme.js';
import type { EnergyChartOptions } from '../types.js';

function theme() {
  return getEnergyChartTheme();
}

function titleBlock(text: string | undefined): EChartsOption['title'] {
  if (!text) return undefined;
  const t = theme();
  return { text, textStyle: { fontSize: 12, color: t.titleColor, fontWeight: 700 }, top: 2, left: 4 };
}

function zonesStops() {
  return [[0.6, '#22c55e'], [0.85, '#f59e0b'], [1, '#ef4444']] as [number, string][];
}

export function buildGaugeSpeedometer(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const min = options.yAxis?.min ?? 0;
  const max = options.yAxis?.max ?? 100;
  const value = options.value ?? 0;
  const title = options.title?.text;
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    series: [{
      type: 'gauge',
      center: ['50%', '58%'],
      radius: '88%',
      min,
      max,
      splitNumber: 8,
      axisLine: { lineStyle: { width: 14, color: zonesStops() } },
      pointer: { length: '62%', width: 5, itemStyle: { color: '#f8fafc' } },
      axisTick: { distance: -18, length: 6, lineStyle: { color: '#94a3b8' } },
      splitLine: { distance: -22, length: 12, lineStyle: { color: '#cbd5e1', width: 2 } },
      axisLabel: { distance: -32, fontSize: 9, color: t.axisColor },
      detail: {
        valueAnimation: true,
        fontSize: 20,
        fontWeight: 900,
        color: t.titleColor,
        offsetCenter: [0, '28%'],
        formatter: `{value}${options.unit ? ` ${options.unit}` : ''}`,
      },
      title: title ? { show: true, offsetCenter: [0, '-42%'], fontSize: 10, color: t.axisColor } : { show: false },
      data: [{ value: Number(value.toFixed(1)), name: title ?? '' }],
    }],
  };
}

export function buildGaugeSolid(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const min = options.yAxis?.min ?? 0;
  const max = options.yAxis?.max ?? 100;
  const value = options.value ?? 0;
  const colors = options.colors ?? t.colors;
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const fill = pct > 0.8 ? '#ef4444' : pct > 0.6 ? '#f59e0b' : colors[0] ?? '#087c8b';
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    series: [{
      type: 'gauge',
      center: ['50%', '60%'],
      radius: '85%',
      startAngle: 200,
      endAngle: -20,
      min,
      max,
      progress: { show: true, width: 16, itemStyle: { color: fill } },
      axisLine: { lineStyle: { width: 16, color: [[1, t.gridColor]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 22,
        fontWeight: 900,
        color: t.titleColor,
        offsetCenter: [0, '8%'],
        formatter: `{value}${options.unit ? ` ${options.unit}` : ''}`,
      },
      data: [{ value: Number(value.toFixed(1)) }],
    }],
  };
}

export function buildGaugeDual(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const min = options.yAxis?.min ?? 0;
  const max = options.yAxis?.max ?? 100;
  const unit = options.unit ? ` ${options.unit}` : '';
  const v1 = cats[0]?.y ?? options.value ?? 0;
  const v2 = cats[1]?.y ?? v1;
  const name1 = cats[0]?.name ?? 'L';
  const name2 = cats[1]?.name ?? 'R';

  const mk = (val: number, center: [string, string], label: string) => ({
    type: 'gauge' as const,
    center,
    radius: '78%',
    min,
    max,
    splitNumber: 6,
    axisLine: { lineStyle: { width: 10, color: [[0.6, '#22c55e'], [0.85, '#f59e0b'], [1, '#ef4444']] as [number, string][] } },
    axisLabel: { fontSize: 8, color: '#94a3b8', distance: 12 },
    pointer: { width: 4, itemStyle: { color: options.colors?.[0] ?? '#087c8b' } },
    detail: {
      fontSize: 14,
      fontWeight: 800,
      color: t.titleColor,
      offsetCenter: [0, '38%'],
      formatter: `{value}${unit}`,
    },
    title: { show: true, offsetCenter: [0, '72%'], fontSize: 9, color: t.axisColor },
    data: [{ value: Number(val.toFixed(1)), name: label }],
  });

  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    series: [mk(v1, ['28%', '55%'], name1), mk(v2, ['72%', '55%'], name2)],
  };
}

export function buildGaugeKpiRings(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const colors = options.colors ?? t.colors;
  const min = options.yAxis?.min ?? 0;
  const max = options.yAxis?.max ?? 100;
  const span = max - min || 1;
  const vals = cats.length >= 1
    ? cats.slice(0, 3).map((c) => Math.min(max, Math.max(min, c.y)))
    : [options.value ?? min, min + span * 0.5, min + span * 0.75];
  const radii = ['88%', '68%', '48%'];
  const toPct = (v: number) => Math.min(100, Math.max(0, ((v - min) / span) * 100));
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    series: vals.map((v, i) => ({
      type: 'gauge' as const,
      center: ['50%', '52%'],
      radius: radii[i],
      startAngle: 90,
      endAngle: -270,
      min: 0,
      max: 100,
      progress: { show: true, width: 8, itemStyle: { color: colors[i % colors.length] } },
      axisLine: { lineStyle: { width: 8, color: [[1, 'rgba(148,163,184,0.25)']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      detail: {
        show: i === 0,
        fontSize: 16,
        fontWeight: 800,
        offsetCenter: [0, 0],
        formatter: `{value}${options.unit ? ` ${options.unit}` : '%'}`,
      },
      data: [{ value: Number(toPct(v).toFixed(1)) }],
    })),
  };
}

export function buildGaugeVu(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const min = options.yAxis?.min ?? 0;
  const max = options.yAxis?.max ?? 100;
  const unit = options.unit ? ` ${options.unit}` : '';
  const v1 = cats[0]?.y ?? options.value ?? 0;
  const v2 = cats[1]?.y ?? v1;
  const mk = (val: number, center: [string, string]) => ({
    type: 'gauge' as const,
    center,
    radius: '70%',
    startAngle: 195,
    endAngle: -15,
    min,
    max,
    axisLine: { lineStyle: { width: 8, color: [[0.5, '#fbbf24'], [0.75, '#f97316'], [1, '#ef4444']] as [number, string][] } },
    pointer: { width: 3, length: '70%', itemStyle: { color: options.colors?.[0] ?? '#1e293b' } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    detail: { fontSize: 11, offsetCenter: [0, '55%'], formatter: `{value}${unit}` },
    data: [{ value: Number(val.toFixed(1)) }],
  });
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    series: [mk(v1, ['28%', '55%']), mk(v2, ['72%', '55%'])],
  };
}

export function buildBullet(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const items = cats.length ? cats : [
    { name: 'Revenue', y: 72 },
    { name: 'Profit', y: 48 },
    { name: 'Customers', y: 61 },
  ];
  const max = Math.max(...items.map((i) => i.y), 100);
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    grid: { left: 80, right: 24, top: 36, bottom: 16 },
    xAxis: { type: 'value', max: max * 1.1, splitLine: { show: false }, axisLabel: { fontSize: 9, color: t.axisColor } },
    yAxis: {
      type: 'category',
      data: items.map((i) => i.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: t.titleColor },
    },
    series: [
      {
        type: 'bar',
        data: items.map((i) => ({
          value: i.y,
          itemStyle: { color: '#38bdf8', borderRadius: [0, 4, 4, 0] },
        })),
        barWidth: 14,
        z: 2,
      },
      {
        type: 'bar',
        data: items.map((i) => Math.round(i.y * 0.55)),
        barWidth: 14,
        itemStyle: { color: 'rgba(148,163,184,0.35)', borderRadius: [0, 4, 4, 0] },
        barGap: '-100%',
        z: 1,
      },
    ],
  } as EChartsOption;
}
