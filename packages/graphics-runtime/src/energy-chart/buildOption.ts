import type { EChartsOption } from 'echarts';
import { fillDemoData } from './demoData.js';
import {
  buildBullet,
  buildGaugeDual,
  buildGaugeKpiRings,
  buildGaugeSolid,
  buildGaugeSpeedometer,
  buildGaugeVu,
} from './builders/gaugeBuilders.js';
import {
  buildArea3D,
  buildColumn3D,
  buildFunnel3D,
  buildPie3DStyle,
  buildScatter3D,
} from './builders/gl3dBuilders.js';
import { getEnergyChartTheme } from './theme.js';
import type { EnergyChartOptions } from './types.js';

function titleBlock(text: string | undefined, theme: ReturnType<typeof getEnergyChartTheme>): EChartsOption['title'] {
  if (!text) return undefined;
  return {
    text,
    textStyle: { fontSize: 12, color: theme.titleColor, fontWeight: 700 },
    top: 2,
    left: 4,
  };
}

function buildLineArea(options: EnergyChartOptions, showArea: boolean): EChartsOption {
  const theme = getEnergyChartTheme();
  const colors = options.colors ?? theme.colors;
  const series = options.series ?? [];
  const smooth = options.plotOptions?.line?.smooth ?? true;
  const allTimes = [...new Set(series.flatMap((s) => s.data.map((p) => String(p.x))))].sort();
  const hasTitle = Boolean(options.title?.text);

  return {
    backgroundColor: options.chart.backgroundColor ?? theme.backgroundColor,
    title: titleBlock(options.title?.text, theme),
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: options.legend?.enabled === false ? undefined : { bottom: 0, textStyle: { fontSize: theme.fontSize, color: theme.axisColor } },
    grid: { top: hasTitle ? 36 : 12, right: 12, bottom: options.legend?.enabled === false ? 24 : 36, left: 48 },
    xAxis: {
      type: 'category',
      data: allTimes.map((t) => {
        const d = new Date(t);
        return Number.isNaN(d.getTime()) ? t : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }),
      axisLabel: { fontSize: theme.fontSize, color: theme.axisColor },
      axisLine: { lineStyle: { color: theme.gridColor } },
    },
    yAxis: {
      type: 'value',
      min: options.yAxis?.min,
      max: options.yAxis?.max,
      axisLabel: { fontSize: theme.fontSize, color: theme.axisColor },
      splitLine: { lineStyle: { color: theme.gridColor, type: 'dashed' } },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      smooth,
      data: allTimes.map((t) => {
        const p = s.data.find((pp) => String(pp.x) === t);
        return p?.y != null ? Number(p.y) : null;
      }),
      connectNulls: true,
      itemStyle: { color: s.color ?? colors[i % colors.length] },
      lineStyle: { width: 2 },
      areaStyle: showArea ? { opacity: options.plotOptions?.area?.opacity ?? 0.15 } : undefined,
      symbol: 'none',
    })),
  };
}

function buildBar(options: EnergyChartOptions, horizontal: boolean): EChartsOption {
  const theme = getEnergyChartTheme();
  const colors = options.colors ?? theme.colors;
  const items = options.categories ?? [];
  const hasTitle = Boolean(options.title?.text);
  const catAxis = {
    type: 'category' as const,
    data: items.map((i) => i.name),
    axisLabel: { fontSize: theme.fontSize, color: theme.axisColor, interval: 0 },
    axisLine: { lineStyle: { color: theme.gridColor } },
  };
  const valAxis = {
    type: 'value' as const,
    min: options.yAxis?.min,
    max: options.yAxis?.max,
    axisLabel: { fontSize: theme.fontSize, color: theme.axisColor },
    splitLine: { lineStyle: { color: theme.gridColor, type: 'dashed' as const } },
  };

  return {
    backgroundColor: options.chart.backgroundColor ?? theme.backgroundColor,
    title: titleBlock(options.title?.text, theme),
    tooltip: { trigger: 'axis' },
    grid: { top: hasTitle ? 36 : 12, right: 12, bottom: horizontal ? 12 : 32, left: 52 },
    xAxis: horizontal ? valAxis : catAxis,
    yAxis: horizontal ? catAxis : valAxis,
    series: [{
      type: 'bar',
      data: items.map((item, idx) => ({
        value: item.y,
        itemStyle: {
          color: item.color ?? colors[idx % colors.length],
          borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
      })),
      barMaxWidth: options.plotOptions?.bar?.maxWidth ?? 40,
    }],
  };
}

function buildPie(options: EnergyChartOptions, donut: boolean): EChartsOption {
  const theme = getEnergyChartTheme();
  const colors = options.colors ?? theme.colors;
  const items = options.categories ?? [];

  return {
    backgroundColor: options.chart.backgroundColor ?? theme.backgroundColor,
    title: titleBlock(options.title?.text, theme),
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: options.legend?.enabled === false ? undefined : {
      orient: 'vertical',
      right: 4,
      top: 'center',
      textStyle: { fontSize: theme.fontSize, color: theme.axisColor },
      itemWidth: 8,
      itemHeight: 8,
    },
    series: [{
      type: 'pie',
      radius: donut ? ['35%', '65%'] : '65%',
      center: ['40%', '55%'],
      data: items.map((item, idx) => ({
        name: item.name,
        value: item.y,
        itemStyle: { color: item.color ?? colors[idx % colors.length] },
      })),
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } },
    }],
  };
}

/** Convert EnergyChartOptions → ECharts option object. */
export function buildEChartsOption(raw: EnergyChartOptions): EChartsOption {
  const options = fillDemoData(raw, false);
  const type = options.chart.type;

  switch (type) {
    case 'line':
      return buildLineArea(options, false);
    case 'area':
      return buildLineArea(options, true);
    case 'bar':
      return buildBar(options, false);
    case 'bar-h':
      return buildBar(options, true);
    case 'pie':
      return buildPie(options, false);
    case 'donut':
      return buildPie(options, true);
    case 'gauge-speedometer':
      return buildGaugeSpeedometer(options);
    case 'gauge-solid':
      return buildGaugeSolid(options);
    case 'gauge-dual':
      return buildGaugeDual(options);
    case 'gauge-kpi-rings':
      return buildGaugeKpiRings(options);
    case 'gauge-vu':
      return buildGaugeVu(options);
    case 'bullet':
      return buildBullet(options);
    case 'column3d':
      return buildColumn3D(options, 'plain');
    case 'column3d-stack':
      return buildColumn3D(options, 'stack');
    case 'column3d-group':
      return buildColumn3D(options, 'group');
    case 'cylinder3d':
      return buildColumn3D(options, 'cylinder');
    case 'scatter3d':
      return buildScatter3D(options);
    case 'area3d':
      return buildArea3D(options);
    case 'pie3d':
      return buildPie3DStyle(options, false);
    case 'donut3d':
      return buildPie3DStyle(options, true);
    case 'funnel3d':
      return buildFunnel3D(options, false);
    case 'pyramid3d':
      return buildFunnel3D(options, true);
    default:
      return {};
  }
}
