import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, GaugeChart, FunnelChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
// @ts-ignore
import { Bar3DChart, Line3DChart, Scatter3DChart, SurfaceChart } from 'echarts-gl/charts';
// @ts-ignore
import { Grid3DComponent } from 'echarts-gl/components';

let registered = false;

export function ensureEchartsCore(): typeof echarts {
  if (!registered) {
    echarts.use([
      LineChart, BarChart, PieChart, GaugeChart, FunnelChart,
      Bar3DChart, Line3DChart, Scatter3DChart, SurfaceChart,
      GridComponent, TooltipComponent, LegendComponent, TitleComponent,
      DataZoomComponent, VisualMapComponent, Grid3DComponent,
      CanvasRenderer,
    ]);
    registered = true;
  }
  return echarts;
}

export type { ECharts, EChartsOption } from 'echarts';
