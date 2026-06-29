/** EnergyLink chart types — declarative API (2D, gauges, 3D). */
export type EnergyChartType =
  | 'line' | 'area' | 'bar' | 'bar-h' | 'pie' | 'donut'
  | 'gauge-speedometer' | 'gauge-solid' | 'gauge-dual' | 'gauge-kpi-rings' | 'gauge-vu' | 'bullet'
  | 'column3d' | 'column3d-stack' | 'column3d-group' | 'cylinder3d'
  | 'pie3d' | 'donut3d' | 'scatter3d' | 'area3d' | 'funnel3d' | 'pyramid3d';

export type EnergyChartPoint = {
  x: string | number;
  y: number | null;
};

export type EnergyChartSeries = {
  name: string;
  type?: 'line' | 'area' | 'bar';
  data: EnergyChartPoint[];
  color?: string;
};

export type EnergyChartCategoryItem = {
  name: string;
  y: number;
  color?: string;
};

export type EnergyChartTitleOptions = {
  text?: string;
  style?: { fontSize?: number; color?: string; fontWeight?: number | string };
};

export type EnergyChartAxisOptions = {
  min?: number;
  max?: number;
};

export type EnergyChartLegendOptions = {
  enabled?: boolean;
};

export type EnergyChartPlotOptions = {
  line?: { smooth?: boolean };
  area?: { opacity?: number };
  bar?: { horizontal?: boolean; maxWidth?: number };
  pie?: { innerSize?: string };
  gauge?: { startAngle?: number; endAngle?: number };
};

export type EnergyChartOptions = {
  chart: {
    type: EnergyChartType;
    backgroundColor?: string;
  };
  title?: EnergyChartTitleOptions;
  colors?: string[];
  xAxis?: EnergyChartAxisOptions;
  yAxis?: EnergyChartAxisOptions;
  series?: EnergyChartSeries[];
  categories?: EnergyChartCategoryItem[];
  value?: number;
  unit?: string;
  legend?: EnergyChartLegendOptions;
  plotOptions?: EnergyChartPlotOptions;
};

export type EnergyChartInstance = {
  setOptions: (options: EnergyChartOptions) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};
