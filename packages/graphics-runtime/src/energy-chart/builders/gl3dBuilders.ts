import type { EChartsOption } from 'echarts';
import { getEnergyChartTheme } from '../theme.js';
import type { EnergyChartCategoryItem, EnergyChartOptions } from '../types.js';

function theme() {
  return getEnergyChartTheme();
}

function titleBlock(text: string | undefined): EChartsOption['title'] {
  if (!text) return undefined;
  const t = theme();
  return { text, textStyle: { fontSize: 12, color: t.titleColor, fontWeight: 700 }, top: 2, left: 4 };
}

function grid3DBase(): Pick<EChartsOption, 'grid3D' | 'xAxis3D' | 'yAxis3D' | 'zAxis3D'> {
  return {
    grid3D: {
      boxWidth: 120,
      boxDepth: 80,
      boxHeight: 60,
      viewControl: { alpha: 28, beta: 32, distance: 180, autoRotate: false },
      light: { main: { intensity: 1.1 }, ambient: { intensity: 0.35 } },
    },
    xAxis3D: { type: 'category' },
    yAxis3D: { type: 'category' },
    zAxis3D: { type: 'value' },
  };
}

function bar3DData(cats: EnergyChartCategoryItem[], seriesIndex = 0): Array<[number, number, number]> {
  return cats.map((c, i) => [i, seriesIndex, c.y]);
}

export function buildColumn3D(options: EnergyChartOptions, mode: 'plain' | 'stack' | 'group' | 'cylinder'): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const colors = options.colors ?? t.colors;
  const names = cats.map((c) => c.name);
  const base = grid3DBase();
  const bevel = mode === 'cylinder' ? { bevelSize: 0.45, bevelSmoothness: 2.2 } : { bevelSize: 0.1, bevelSmoothness: 1 };

  if (mode === 'stack' || mode === 'group') {
    const s2 = cats.map((c, i) => ({ name: `${c.name} B`, y: Math.round(c.y * 0.65) }));
    const series = mode === 'stack'
      ? [
          { name: 'A', data: bar3DData(cats, 0) },
          { name: 'B', data: bar3DData(s2, 0).map(([x, , z], i) => [x, 0, z + (cats[i]?.y ?? 0) * 0.35] as [number, number, number]) },
        ]
      : [
          { name: 'A', data: bar3DData(cats, 0) },
          { name: 'B', data: bar3DData(s2, 1) },
        ];
    return {
      backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
      title: titleBlock(options.title?.text),
      tooltip: {},
      ...base,
      xAxis3D: { type: 'category', data: names },
      yAxis3D: { type: 'category', data: mode === 'group' ? ['A', 'B'] : [''] },
      series: series.map((s, si) => ({
        type: 'bar3D',
        name: s.name,
        stack: mode === 'stack' ? 'total' : undefined,
        data: s.data,
        shading: 'lambert',
        itemStyle: { color: colors[si % colors.length], opacity: 0.92 },
        ...bevel,
      })),
    } as EChartsOption;
  }

  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    tooltip: {},
    ...base,
    xAxis3D: { type: 'category', data: names },
    yAxis3D: { type: 'category', data: [''] },
    series: [{
      type: 'bar3D',
      data: bar3DData(cats, 0),
      shading: 'lambert',
      itemStyle: {
        color: (params: { dataIndex: number }) => colors[params.dataIndex % colors.length],
        opacity: 0.95,
      },
      bevelSize: bevel.bevelSize,
      bevelSmoothness: bevel.bevelSmoothness,
    }],
  } as EChartsOption;
}

export function buildScatter3D(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const colors = options.colors ?? t.colors;
  const data: Array<[number, number, number]> = cats.length
    ? cats.map((c, i) => [i, (i * 7) % cats.length, c.y])
  : Array.from({ length: 24 }, (_, i) => [Math.sin(i) * 5 + 5, Math.cos(i * 0.7) * 4 + 4, 20 + Math.sin(i * 0.5) * 30]);

  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    ...grid3DBase(),
    series: [{
      type: 'scatter3D',
      data,
      symbolSize: 10,
      itemStyle: { color: colors[0], opacity: 0.85 },
    }],
  } as EChartsOption;
}

export function buildArea3D(options: EnergyChartOptions): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const w = Math.max(6, cats.length || 10);
  const data: Array<[number, number, number]> = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < 6; y++) {
      const z = 10 + Math.sin(x / 2) * 12 + Math.cos(y) * 8 + (cats[x]?.y ?? 40) * 0.15;
      data.push([x, y, z]);
    }
  }
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    ...grid3DBase(),
    series: [{
      type: 'surface',
      wireframe: { show: false },
      shading: 'color',
      itemStyle: { color: colorsFirst(t.colors) },
      data,
    }],
  } as EChartsOption;
}

function colorsFirst(colors: string[]) {
  return colors[0] ?? '#087c8b';
}

export function buildPie3DStyle(options: EnergyChartOptions, donut: boolean): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const colors = options.colors ?? t.colors;
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: donut ? ['38%', '68%'] : '68%',
      center: ['50%', '52%'],
      itemStyle: {
        borderRadius: 6,
        borderColor: '#0f172a',
        borderWidth: 2,
        shadowBlur: 18,
        shadowColor: 'rgba(0,0,0,0.45)',
        shadowOffsetY: 8,
      },
      label: { color: t.axisColor, fontSize: 10 },
      data: cats.map((c, i) => ({
        name: c.name,
        value: c.y,
        itemStyle: { color: c.color ?? colors[i % colors.length] },
      })),
    }],
    graphic: [{
      type: 'ellipse',
      shape: { cx: 200, cy: 280, rx: 120, ry: 28 },
      style: { fill: 'rgba(0,0,0,0.2)' },
      bottom: 8,
      left: 'center',
    }],
  } as EChartsOption;
}

export function buildFunnel3D(options: EnergyChartOptions, pyramid: boolean): EChartsOption {
  const t = theme();
  const cats = options.categories ?? [];
  const colors = options.colors ?? t.colors;
  const sorted = pyramid
    ? [...cats].sort((a, b) => a.y - b.y)
    : [...cats].sort((a, b) => b.y - a.y);
  return {
    backgroundColor: options.chart.backgroundColor ?? t.backgroundColor,
    title: titleBlock(options.title?.text),
    tooltip: { trigger: 'item' },
    series: [{
      type: 'funnel',
      sort: pyramid ? 'ascending' : 'descending',
      gap: 4,
      min: 0,
      max: Math.max(...sorted.map((c) => c.y), 100),
      label: { show: true, position: 'inside', color: '#fff', fontSize: 10 },
      itemStyle: {
        borderColor: '#0f172a',
        borderWidth: 1,
        shadowBlur: 12,
        shadowColor: 'rgba(0,0,0,0.35)',
        shadowOffsetY: 6,
      },
      data: sorted.map((c, i) => ({
        name: c.name,
        value: c.y,
        itemStyle: { color: c.color ?? colors[i % colors.length] },
      })),
    }],
  } as EChartsOption;
}
